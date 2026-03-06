/**
 * Backfill shift_location on claims by looking up the shift in Redshift
 * (proId + dateOfInjury + partnerName), reverse-geocoding the gig template geocode,
 * and storing the address. Also backfills partner_state from the shift if blank.
 */
import { db } from "../db";
import { claims } from "@shared/schema";
import { executeRedshiftQuery } from "../redshift";
import { sql, eq } from "drizzle-orm";
import pLimit from "p-limit";
import { EXECUTE, sanitize, teardown } from "./lib/shared";

const geocodeCache = new Map<string, { city: string | null; state: string | null; address: string | null }>();
let lastGeocodeTick = 0;

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function reverseGeocode(geocode: string): Promise<{ city: string | null; state: string | null; address: string | null } | null> {
  if (geocodeCache.has(geocode)) return geocodeCache.get(geocode)!;
  const parts = geocode.split(",").map((s) => s.trim());
  if (parts.length !== 2) return null;
  const [lat, lon] = parts;

  const now = Date.now();
  const elapsed = now - lastGeocodeTick;
  if (elapsed < 1100) await delay(1100 - elapsed);
  lastGeocodeTick = Date.now();

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=16`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Incidentally/1.0 (internal workers comp tool)" },
    });
    if (!res.ok) return null;
    const data = await res.json() as any;
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.village || addr.hamlet || addr.county || null;
    const state = addr["ISO3166-2-lvl4"]?.replace("US-", "") || addr.state || null;
    const displayParts = [addr.road, city, state ? `${state} ${addr.postcode || ""}`.trim() : null].filter(Boolean);
    const address = displayParts.join(", ") || data.display_name || null;
    const result = { city, state: state?.length === 2 ? state : null, address };
    geocodeCache.set(geocode, result);
    return result;
  } catch {
    return null;
  }
}

async function findShiftGeocode(proId: number, doi: string, partnerName: string | null): Promise<{ geocode: string; shiftId: number; businessName: string } | null> {
  const safeDate = sanitize(doi);
  const nextDay = new Date(doi);
  nextDay.setDate(nextDay.getDate() + 1);
  const safeNext = nextDay.toISOString().split("T")[0];

  let partnerClause = "";
  if (partnerName && partnerName.trim()) {
    const safe = sanitize(partnerName).substring(0, 50);
    partnerClause = `AND LOWER(TRIM(g.business_name)) LIKE LOWER('%${safe}%')`;
  }

  const query = `
    SELECT g.shift_id, g.business_name, t.geocode AS template_geocode
    FROM iw_backend_db.gigs_view g
    LEFT JOIN iw_backend_db.backend_gigtemplate t ON g.gig_template_id = t.id
    WHERE g.worker_id = ${proId}
      AND g.starts_at >= '${safeDate}'
      AND g.starts_at < '${safeNext}'
      AND g.is_cancelled = 0
      ${partnerClause}
    LIMIT 1
  `;

  try {
    const { columns, rows } = await executeRedshiftQuery(query);
    if (rows.length === 0) return null;
    const ci = Object.fromEntries(columns.map((c, i) => [c, i]));
    const geocode = rows[0][ci.template_geocode] as string | null;
    if (!geocode) return null;
    return {
      geocode,
      shiftId: rows[0][ci.shift_id] as number,
      businessName: (rows[0][ci.business_name] as string) || "",
    };
  } catch {
    return null;
  }
}

async function run() {
  console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY RUN"}\n`);

  const eligible = await db.select({
    id: claims.id,
    matterNumber: claims.matterNumber,
    proId: claims.proId,
    dateOfInjury: claims.dateOfInjury,
    partnerName: claims.partnerName,
    partnerState: claims.partnerState,
    shiftLocation: claims.shiftLocation,
    firstName: claims.firstName,
    lastName: claims.lastName,
  }).from(claims)
    .where(sql`
      pro_id IS NOT NULL AND pro_id != ''
      AND (shift_location IS NULL OR shift_location = '')
      AND deleted_at IS NULL
    `)
    .orderBy(claims.id);

  console.log(`Found ${eligible.length} claims with Pro ID but no shift_location\n`);

  let filled = 0;
  let noGeocode = 0;
  let noAddress = 0;
  let errorCount = 0;
  let processed = 0;

  const limit = pLimit(2);
  const tasks = eligible.map((c) => limit(async () => {
    const idx = ++processed;
    const label = `${c.matterNumber || "#" + c.id} (${c.lastName}, ${c.firstName} | Pro ${c.proId})`;
    if (idx % 25 === 0) console.log(`  ... ${idx}/${eligible.length}`);

    const proId = parseInt(c.proId!, 10);
    if (isNaN(proId)) {
      errorCount++;
      return;
    }

    const shift = await findShiftGeocode(proId, c.dateOfInjury, c.partnerName);
    if (!shift) {
      noGeocode++;
      return;
    }

    const geo = await reverseGeocode(shift.geocode);
    if (!geo || !geo.address) {
      noAddress++;
      return;
    }

    filled++;
    console.log(`  FILL  ${label} → ${geo.address} (${geo.state || "?"})`);

    if (EXECUTE) {
      const updates: Record<string, any> = { shiftLocation: geo.address };
      if ((!c.partnerState || c.partnerState === "") && geo.state) {
        updates.partnerState = geo.state;
      }
      await db.update(claims).set(updates).where(eq(claims.id, c.id));
    }
  }));
  await Promise.all(tasks);

  console.log("\n========== SUMMARY ==========");
  console.log(`Eligible claims:      ${eligible.length}`);
  console.log(`Filled:               ${filled}`);
  console.log(`No geocode in shift:  ${noGeocode}`);
  console.log(`Geocode but no addr:  ${noAddress}`);
  console.log(`Errors:               ${errorCount}`);

  if (!EXECUTE && filled > 0) {
    console.log(`\n(Dry run — run with --execute to apply ${filled} updates.)`);
  }
}

run()
  .then(() => teardown(0))
  .catch((err) => { console.error("Failed:", err); teardown(1); });
