import { db } from "./db";
import { claims, proShifts } from "@shared/schema";
import { isNull, inArray, desc } from "drizzle-orm";
import { executeRedshiftQuery } from "./redshift";

export interface IncidentRate {
  label: string;
  claimCount: number;
  shiftCount: number;
  rate: number;
}

export interface ShiftDetail {
  claimId: number;
  claimantName: string;
  proId: string;
  injuryType: string;
  dateOfInjury: string;
  shiftPosition: string;
  partnerName: string;
  partnerState: string;
  workerType: string;
  shiftStartHour: number | null;
  shiftDurationHours: number | null;
  dayOfWeek: string | null;
  businessName: string | null;
  shiftState: string | null;
}

export interface RiskAnalyticsData {
  byPosition: IncidentRate[];
  byState: IncidentRate[];
  byPartner: IncidentRate[];
  byWorkerType: IncidentRate[];
  openClaimShiftDetails: ShiftDetail[];
  shiftVolumeAvailable: boolean;
}

let cachedAnalytics: { data: RiskAnalyticsData; fetchedAt: number } | null = null;
let inflightPromise: Promise<RiskAnalyticsData> | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000;

export function invalidateRiskAnalyticsCache(): void {
  cachedAnalytics = null;
}

export async function getRiskAnalytics(): Promise<RiskAnalyticsData> {
  if (cachedAnalytics && Date.now() - cachedAnalytics.fetchedAt < CACHE_TTL_MS) {
    return cachedAnalytics.data;
  }

  if (inflightPromise) return inflightPromise;

  inflightPromise = computeRiskAnalytics().finally(() => {
    inflightPromise = null;
  });

  return inflightPromise;
}

async function computeRiskAnalytics(): Promise<RiskAnalyticsData> {
  const allClaims = await db.select().from(claims).where(isNull(claims.deletedAt));

  const claimsByPosition = new Map<string, number>();
  const claimsByState = new Map<string, number>();
  const claimsByPartner = new Map<string, number>();
  const claimsByWorkerType = new Map<string, number>();

  allClaims.forEach(c => {
    if (c.shiftType) claimsByPosition.set(c.shiftType, (claimsByPosition.get(c.shiftType) || 0) + 1);
    const state = c.stateOfInjury || c.partnerState;
    if (state) claimsByState.set(state, (claimsByState.get(state) || 0) + 1);
    if (c.partnerName) claimsByPartner.set(c.partnerName, (claimsByPartner.get(c.partnerName) || 0) + 1);
    if (c.workerType) claimsByWorkerType.set(c.workerType, (claimsByWorkerType.get(c.workerType) || 0) + 1);
  });

  let shiftsByPosition = new Map<string, number>();
  let shiftsByState = new Map<string, number>();
  let shiftsByPartner = new Map<string, number>();
  let shiftsByWorkerType = new Map<string, number>();
  let shiftVolumeAvailable = false;

  const dates = allClaims
    .filter(c => c.dateOfInjury)
    .map(c => new Date(c.dateOfInjury));
  const minDate = dates.length > 0
    ? new Date(Math.min(...dates.map(d => d.getTime())))
    : new Date("2022-04-01");
  const startStr = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);
  const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;

  const dateFilter = `g.is_cancelled = 0 AND g.starts_at >= '${startStr}' AND g.starts_at < '${endStr}'`;

  try {
    const [posResult, stateResult, partResult, wtResult] = await Promise.all([
      executeRedshiftQuery(`
        SELECT g.gig_position, COUNT(*) AS shift_count
        FROM iw_backend_db.gigs_view g
        WHERE ${dateFilter} AND g.gig_position IS NOT NULL
        GROUP BY g.gig_position ORDER BY shift_count DESC
      `),
      executeRedshiftQuery(`
        SELECT g.worker_sub_region_name AS state, COUNT(*) AS shift_count
        FROM iw_backend_db.gigs_view g
        WHERE ${dateFilter} AND g.worker_sub_region_name IS NOT NULL
        GROUP BY g.worker_sub_region_name ORDER BY shift_count DESC
      `),
      executeRedshiftQuery(`
        SELECT g.business_name, COUNT(*) AS shift_count
        FROM iw_backend_db.gigs_view g
        WHERE ${dateFilter} AND g.business_name IS NOT NULL
        GROUP BY g.business_name ORDER BY shift_count DESC
      `),
      executeRedshiftQuery(`
        SELECT CASE WHEN t.w2_employees_only = 1 THEN 'W2' ELSE '1099' END AS worker_type,
               COUNT(*) AS shift_count
        FROM iw_backend_db.gigs_view g
        LEFT JOIN iw_backend_db.backend_gigtemplate t ON g.gig_template_id = t.id
        WHERE ${dateFilter}
        GROUP BY worker_type
      `),
    ]);

    const parseRows = (cols: string[], rows: string[][], keyCol: string, valCol: string) => {
      const idx = Object.fromEntries(cols.map((c, i) => [c, i]));
      const map = new Map<string, number>();
      rows.forEach(r => {
        const key = r[idx[keyCol]] as string;
        const val = Number(r[idx[valCol]]) || 0;
        if (key && val > 0) map.set(key, val);
      });
      return map;
    };

    shiftsByPosition = parseRows(posResult.columns, posResult.rows, "gig_position", "shift_count");
    shiftsByState = parseRows(stateResult.columns, stateResult.rows, "state", "shift_count");
    shiftsByPartner = parseRows(partResult.columns, partResult.rows, "business_name", "shift_count");
    shiftsByWorkerType = parseRows(wtResult.columns, wtResult.rows, "worker_type", "shift_count");

    shiftVolumeAvailable = true;
  } catch (err) {
    console.error("Redshift aggregate shift queries failed:", err);
  }

  const buildRates = (
    claimsMap: Map<string, number>,
    shiftsMap: Map<string, number>,
  ): IncidentRate[] => {
    const all = new Set([...claimsMap.keys(), ...shiftsMap.keys()]);
    return Array.from(all)
      .map(label => {
        const claimCount = claimsMap.get(label) || 0;
        const shiftCount = shiftsMap.get(label) || 0;
        const rate = shiftCount > 0 ? (claimCount / shiftCount) * 1000 : 0;
        return { label, claimCount, shiftCount, rate };
      })
      .filter(r => r.claimCount > 0)
      .sort((a, b) => b.rate - a.rate);
  };

  const byPosition = buildRates(claimsByPosition, shiftsByPosition);
  const byState = buildRates(claimsByState, shiftsByState);
  const byPartner = buildRates(claimsByPartner, shiftsByPartner);
  const byWorkerType = buildRates(claimsByWorkerType, shiftsByWorkerType);

  const topPositions = ["General Labor", "Warehouse Associate"];
  const openHighRisk = allClaims.filter(
    c => c.claimStatus === "Open" && c.shiftType && topPositions.includes(c.shiftType)
  );

  const proIds = [...new Set(
    openHighRisk.map(c => c.proId ? parseInt(c.proId) : null).filter((id): id is number => id !== null && !isNaN(id))
  )];

  const allShiftsForPros = proIds.length > 0
    ? await db.select().from(proShifts).where(inArray(proShifts.proId, proIds)).orderBy(desc(proShifts.startsAt))
    : [];

  const shiftsByPro = new Map<number, typeof allShiftsForPros>();
  allShiftsForPros.forEach(s => {
    const arr = shiftsByPro.get(s.proId) || [];
    arr.push(s);
    shiftsByPro.set(s.proId, arr);
  });

  const openClaimShiftDetails: ShiftDetail[] = openHighRisk.map(c => {
    const proId = c.proId ? parseInt(c.proId) : null;
    let shiftStartHour: number | null = null;
    let shiftDurationHours: number | null = null;
    let dayOfWeek: string | null = null;
    let businessName: string | null = c.partnerName;
    let shiftState: string | null = c.partnerState || c.stateOfInjury || null;

    if (proId && c.dateOfInjury) {
      const doi = new Date(c.dateOfInjury);
      const doiStr = doi.toISOString().split("T")[0];
      const proShiftList = shiftsByPro.get(proId) || [];

      const matched = proShiftList.find(s => {
        if (!s.startsAt) return false;
        return new Date(s.startsAt).toISOString().split("T")[0] === doiStr;
      });

      if (matched?.startsAt) {
        const start = new Date(matched.startsAt);
        shiftStartHour = start.getHours();
        dayOfWeek = start.toLocaleDateString("en-US", { weekday: "long" });
        if (matched.endsAt) {
          const end = new Date(matched.endsAt);
          shiftDurationHours = Math.round(((end.getTime() - start.getTime()) / 3600000) * 10) / 10;
        }
        if (matched.businessName) businessName = matched.businessName;
        if (matched.shiftState) shiftState = matched.shiftState;
      } else if (c.dateOfInjury) {
        dayOfWeek = new Date(c.dateOfInjury).toLocaleDateString("en-US", { weekday: "long" });
      }
    } else if (c.dateOfInjury) {
      dayOfWeek = new Date(c.dateOfInjury).toLocaleDateString("en-US", { weekday: "long" });
    }

    return {
      claimId: c.id,
      claimantName: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
      proId: c.proId || "",
      injuryType: c.injuryType || "",
      dateOfInjury: c.dateOfInjury || "",
      shiftPosition: c.shiftType || "",
      partnerName: businessName || "",
      partnerState: shiftState || "",
      workerType: c.workerType || "",
      shiftStartHour,
      shiftDurationHours,
      dayOfWeek,
      businessName,
      shiftState,
    };
  });

  const data: RiskAnalyticsData = {
    byPosition,
    byState,
    byPartner,
    byWorkerType,
    openClaimShiftDetails,
    shiftVolumeAvailable,
  };

  cachedAnalytics = { data, fetchedAt: Date.now() };
  return data;
}
