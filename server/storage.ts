import {
  claims,
  claimNotes,
  claimStatusHistory,
  companies,
  insurancePolicies,
  type Claim,
  type InsertClaim,
  type ClaimNote,
  type InsertClaimNote,
  type ClaimStatusHistory,
  type InsertClaimStatusHistory,
  type Company,
  type InsertCompany,
  type InsurancePolicy,
  type InsertPolicy,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, ilike, or, and, isNull, SQL } from "drizzle-orm";

function buildSmartSearch(query: string): SQL {
  const trimmed = query.trim();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const fullName = sql`(first_name || ' ' || last_name)`;

  const conditions: SQL[] = [];

  if (tokens.length === 1) {
    const t = tokens[0];
    const pat = `%${t}%`;
    conditions.push(sql`(
      first_name ILIKE ${pat}
      OR last_name ILIKE ${pat}
      OR partner_name ILIKE ${pat}
      OR tpa_claim_id ILIKE ${pat}
      OR matter_number ILIKE ${pat}
      OR pro_id ILIKE ${pat}
    )`);
  } else {
    const tokenConditions = tokens.map((t) => {
      const pat = `%${t}%`;
      return sql`(first_name ILIKE ${pat} OR last_name ILIKE ${pat})`;
    });
    conditions.push(sql`(${sql.join(tokenConditions, sql` AND `)})`);

    const fullPat = `%${trimmed}%`;
    conditions.push(sql`partner_name ILIKE ${fullPat}`);
    conditions.push(sql`tpa_claim_id ILIKE ${fullPat}`);
    conditions.push(sql`matter_number ILIKE ${fullPat}`);
  }

  conditions.push(sql`similarity(${fullName}, ${trimmed}) > 0.25`);

  return sql`(${sql.join(conditions, sql` OR `)})`;
}

export interface IStorage {
  getClaims(filters?: ClaimFilters): Promise<Claim[]>;
  getClaim(id: number): Promise<Claim | undefined>;
  createClaim(claim: InsertClaim): Promise<Claim>;
  updateClaim(id: number, claim: Partial<InsertClaim>): Promise<Claim | undefined>;
  deleteClaim(id: number): Promise<void>;
  getClaimNotes(claimId: number): Promise<ClaimNote[]>;
  createClaimNote(note: InsertClaimNote): Promise<ClaimNote>;
  updateClaimNote(id: number, updates: Partial<InsertClaimNote>): Promise<ClaimNote | undefined>;
  getClaimStatusHistory(claimId: number): Promise<ClaimStatusHistory[]>;
  createClaimStatusHistory(entry: InsertClaimStatusHistory): Promise<ClaimStatusHistory>;
  getDashboardStats(): Promise<DashboardStats>;
  getFinancials(): Promise<FinancialsData>;
  searchClaims(query: string): Promise<Claim[]>;
  /** Find one claim for sync by matter number, TPA claim ID, or pro+DOI, or name+DOI. */
  findClaimForSync(criteria: {
    matterNumber?: string;
    tpaClaimId?: string;
    proId?: string;
    dateOfInjury?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<Claim | undefined>;
}

export interface ClaimFilters {
  stage?: string;
  claimStatus?: string;
  workerType?: string;
  stateOfInjury?: string;
  partnerName?: string;
  carrier?: string;
  litigated?: boolean;
  tnsSpecialist?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FinancialBucket {
  label: string;
  claimCount: number;
  openCount: number;
  closedCount: number;
  w2Count: number;
  ioccCount: number;
  lossesPaid: number;
  medicalIncurred: number;
  lae: number;
  reserves: number;
  totalIncurred: number;
}

export interface FinancialsData {
  openSummary: FinancialBucket;
  allSummary: FinancialBucket;
  byCalendarYear: FinancialBucket[];
  byPolicyYear: FinancialBucket[];
  byWorkerType: FinancialBucket[];
  topClaimsByIncurred: { id: number; name: string; proId: string; injuryType: string; dateOfInjury: string; workerType: string; totalIncurred: number; lossesPaid: number; medicalIncurred: number }[];
}

export interface DashboardStats {
  totalClaims: number;
  totalOpen: number;
  totalClosed: number;
  totalIncurred: number;
  totalPayments: number;
  totalOutstanding: number;
  totalMedical: number;
  totalLAE: number;
  inLitigation: number;
  w2Claims: number;
  ioccClaims: number;
  statusBreakdown: { status: string; count: number }[];
  stageBreakdown: { stage: string; count: number }[];
  monthlyBreakdown: { month: string; count: number }[];
  workerTypeMonthly: { month: string; w2: number; iocc: number }[];
  byState: { state: string; count: number }[];
  byInjuryType: { type: string; count: number }[];
  byPosition: { position: string; count: number }[];
  repeatPros: { proId: string; name: string; count: number }[];
}

export class DatabaseStorage implements IStorage {
  async getClaims(filters?: ClaimFilters): Promise<Claim[]> {
    let conditions: any[] = [isNull(claims.deletedAt)];
    if (filters) {
      if (filters.stage) conditions.push(eq(claims.stage, filters.stage as any));
      if (filters.claimStatus) conditions.push(eq(claims.claimStatus, filters.claimStatus as any));
      if (filters.workerType) conditions.push(eq(claims.workerType, filters.workerType as any));
      if (filters.stateOfInjury) conditions.push(eq(claims.stateOfInjury, filters.stateOfInjury));
      if (filters.partnerName) conditions.push(ilike(claims.partnerName, `%${filters.partnerName}%`));
      if (filters.carrier) conditions.push(ilike(claims.carrier!, `%${filters.carrier}%`));
      if (filters.litigated !== undefined) conditions.push(eq(claims.litigated, filters.litigated));
      if (filters.tnsSpecialist) conditions.push(eq(claims.tnsSpecialist, filters.tnsSpecialist));
      if (filters.search) {
        conditions.push(buildSmartSearch(filters.search));
      }
    }

    const orderClause = filters?.search
      ? sql`similarity(first_name || ' ' || last_name, ${filters.search.trim()}) DESC, created_at DESC`
      : sql`created_at DESC`;
    let query = db.select().from(claims).where(and(...conditions)).orderBy(orderClause);
    const limit = filters?.limit;
    const offset = filters?.offset;
    if (limit && limit > 0) query = query.limit(limit) as typeof query;
    if (offset && offset > 0) query = query.offset(offset) as typeof query;
    return await query;
  }

  async getClaim(id: number): Promise<Claim | undefined> {
    const [claim] = await db.select().from(claims).where(and(eq(claims.id, id), isNull(claims.deletedAt)));
    return claim || undefined;
  }

  async findClaimForSync(criteria: {
    matterNumber?: string;
    tpaClaimId?: string;
    proId?: string;
    dateOfInjury?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<Claim | undefined> {
    const { matterNumber, tpaClaimId, proId, dateOfInjury, firstName, lastName } = criteria;
    const base = and(isNull(claims.deletedAt));

    if (matterNumber?.trim()) {
      const [c] = await db.select().from(claims).where(and(base, eq(claims.matterNumber, matterNumber.trim()))).limit(1);
      if (c) return c;
    }
    if (tpaClaimId?.trim()) {
      const [c] = await db.select().from(claims).where(and(base, eq(claims.tpaClaimId, tpaClaimId.trim()))).limit(1);
      if (c) return c;
    }
    if (proId?.trim() && dateOfInjury) {
      const [c] = await db
        .select()
        .from(claims)
        .where(and(base, eq(claims.proId, proId.trim()), eq(claims.dateOfInjury, dateOfInjury)))
        .limit(1);
      if (c) return c;
    }
    if (firstName?.trim() && lastName?.trim() && dateOfInjury) {
      const [c] = await db
        .select()
        .from(claims)
        .where(
          and(
            base,
            sql`LOWER(TRIM(first_name)) = LOWER(TRIM(${firstName}))`,
            sql`LOWER(TRIM(last_name)) = LOWER(TRIM(${lastName}))`,
            eq(claims.dateOfInjury, dateOfInjury)
          )
        )
        .limit(1);
      if (c) return c;
    }
    return undefined;
  }

  async createClaim(claim: InsertClaim): Promise<Claim> {
    const matterNumber = await this.generateMatterNumber(
      claim.dateOfInjury,
      claim.stateOfInjury || null,
      claim.workerType,
    );
    const [newClaim] = await db.insert(claims).values({ ...claim, matterNumber }).returning();
    return newClaim;
  }

  private async generateMatterNumber(
    dateOfInjury: string,
    stateOfInjury: string | null | undefined,
    workerType: string,
  ): Promise<string> {
    const doi = dateOfInjury.replace(/-/g, "");
    const st = (stateOfInjury || "XX").toUpperCase().substring(0, 2);
    const wclass = workerType === "W2" ? "EE" : "IC";
    const pattern = `${doi}__-${st}-${wclass}`;

    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS cnt FROM claims
      WHERE matter_number LIKE ${pattern}
    `);
    const existing = (result as any).rows[0]?.cnt || 0;
    const seq = String(existing + 1).padStart(2, "0");
    return `${doi}${seq}-${st}-${wclass}`;
  }

  async updateClaim(id: number, updates: Partial<InsertClaim>): Promise<Claim | undefined> {
    const needsRegen = updates.dateOfInjury || updates.stateOfInjury !== undefined || updates.workerType;
    let finalUpdates: Record<string, any> = { ...updates, updatedAt: new Date() };

    if (needsRegen) {
      const existing = await this.getClaim(id);
      if (existing) {
        const doi = (updates.dateOfInjury || existing.dateOfInjury) as string;
        const st = updates.stateOfInjury !== undefined ? updates.stateOfInjury : existing.stateOfInjury;
        const wt = (updates.workerType || existing.workerType) as string;
        finalUpdates.matterNumber = await this.generateMatterNumber(doi, st, wt);
      }
    }

    const [updated] = await db
      .update(claims)
      .set(finalUpdates)
      .where(eq(claims.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteClaim(id: number): Promise<void> {
    await db.delete(claims).where(eq(claims.id, id));
  }

  async mergeClaims(
    primaryId: number,
    secondaryId: number,
    resolvedFields: Record<string, any>,
    mergedBy: string,
  ): Promise<Claim | undefined> {
    const primary = await this.getClaim(primaryId);
    const secondary = await this.getClaim(secondaryId);
    if (!primary || !secondary) return undefined;

    const mergeData: Record<string, any> = { ...resolvedFields, updatedAt: new Date() };
    const [updated] = await db.update(claims).set(mergeData).where(eq(claims.id, primaryId)).returning();

    await db.update(claimNotes).set({ claimId: primaryId }).where(eq(claimNotes.claimId, secondaryId));
    await db.update(claimStatusHistory).set({ claimId: primaryId }).where(eq(claimStatusHistory.claimId, secondaryId));

    await this.softDeleteClaim(secondaryId, mergedBy, `Merged into incident ${updated.matterNumber || `#${primaryId}`}`);

    await this.createClaimStatusHistory({
      claimId: primaryId,
      fromStatus: primary.claimStatus,
      toStatus: updated.claimStatus,
      fromStage: primary.stage,
      toStage: updated.stage,
      changedBy: mergedBy,
      changes: JSON.stringify({ action: "Merged incidents", mergedFrom: `Incident ${secondary.matterNumber || `#${secondaryId}`}` }),
    });

    return updated;
  }

  async softDeleteClaim(id: number, deletedBy: string, reason: string): Promise<Claim | undefined> {
    const [updated] = await db.update(claims).set({
      deletedAt: new Date(),
      deletedBy,
      deleteReason: reason,
    }).where(and(eq(claims.id, id), isNull(claims.deletedAt))).returning();
    return updated;
  }

  async getClaimNotes(claimId: number): Promise<ClaimNote[]> {
    return await db
      .select()
      .from(claimNotes)
      .where(eq(claimNotes.claimId, claimId))
      .orderBy(desc(claimNotes.createdAt));
  }

  async createClaimNote(note: InsertClaimNote): Promise<ClaimNote> {
    const [newNote] = await db.insert(claimNotes).values(note).returning();
    return newNote;
  }

  async updateClaimNote(id: number, updates: Partial<InsertClaimNote>): Promise<ClaimNote | undefined> {
    const [updated] = await db
      .update(claimNotes)
      .set(updates)
      .where(eq(claimNotes.id, id))
      .returning();
    return updated || undefined;
  }

  async getClaimStatusHistory(claimId: number): Promise<ClaimStatusHistory[]> {
    return await db
      .select()
      .from(claimStatusHistory)
      .where(eq(claimStatusHistory.claimId, claimId))
      .orderBy(desc(claimStatusHistory.changedAt));
  }

  async createClaimStatusHistory(entry: InsertClaimStatusHistory): Promise<ClaimStatusHistory> {
    const [newEntry] = await db.insert(claimStatusHistory).values(entry).returning();
    return newEntry;
  }

  async searchClaims(query: string): Promise<Claim[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const fullName = sql`(first_name || ' ' || last_name)`;
    return await db
      .select()
      .from(claims)
      .where(
        and(
          isNull(claims.deletedAt),
          buildSmartSearch(trimmed),
        )
      )
      .orderBy(sql`similarity(${fullName}, ${trimmed}) DESC`, desc(claims.createdAt))
      .limit(50);
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const notDeleted = sql`deleted_at IS NULL`;
    const incurredExpr = sql`GREATEST(COALESCE(losses_paid,0), COALESCE(medical_total,0)) + COALESCE(loss_adjusting_expenses,0) + COALESCE(total_outstanding,0) + COALESCE(total_payments,0)`;

    const [totals, statusRows, stageRows, monthRows, stateRows, injuryRows, posRows, proRows] = await Promise.all([
      db.execute(sql`
        SELECT
          COUNT(*)::int AS total_claims,
          COUNT(*) FILTER (WHERE claim_status = 'Open')::int AS total_open,
          COUNT(*) FILTER (WHERE claim_status = 'Closed')::int AS total_closed,
          COUNT(*) FILTER (WHERE litigated = true OR stage = 'litigation')::int AS in_litigation,
          COUNT(*) FILTER (WHERE worker_type = 'W2')::int AS w2_claims,
          COUNT(*) FILTER (WHERE worker_type = '1099')::int AS iocc_claims,
          COALESCE(SUM(COALESCE(losses_paid,0)),0)::float AS total_payments,
          COALESCE(SUM(COALESCE(total_outstanding,0)),0)::float AS total_outstanding,
          COALESCE(SUM(COALESCE(medical_total,0)),0)::float AS total_medical,
          COALESCE(SUM(COALESCE(loss_adjusting_expenses,0)),0)::float AS total_lae,
          COALESCE(SUM(${incurredExpr}) FILTER (WHERE claim_status = 'Open'),0)::float AS total_incurred
        FROM claims WHERE ${notDeleted}
      `),
      db.execute(sql`
        SELECT COALESCE(claim_status::text, 'Unknown') AS status, COUNT(*)::int AS count
        FROM claims WHERE ${notDeleted}
        GROUP BY claim_status ORDER BY count DESC
      `),
      db.execute(sql`
        SELECT COALESCE(stage::text, 'intake') AS stage, COUNT(*)::int AS count
        FROM claims WHERE ${notDeleted} AND claim_status = 'Open'
        GROUP BY stage ORDER BY count DESC
      `),
      db.execute(sql`
        SELECT TO_CHAR(date_of_injury, 'YYYY-MM') AS month,
               COUNT(*)::int AS total,
               COUNT(*) FILTER (WHERE worker_type = 'W2')::int AS w2,
               COUNT(*) FILTER (WHERE worker_type = '1099')::int AS iocc
        FROM claims WHERE ${notDeleted} AND date_of_injury IS NOT NULL
        GROUP BY month ORDER BY month DESC LIMIT 12
      `),
      db.execute(sql`
        SELECT COALESCE(state_of_injury, partner_state) AS state, COUNT(*)::int AS count
        FROM claims WHERE ${notDeleted} AND COALESCE(state_of_injury, partner_state) IS NOT NULL
        GROUP BY state ORDER BY count DESC
      `),
      db.execute(sql`
        SELECT injury_type AS type, COUNT(*)::int AS count
        FROM claims WHERE ${notDeleted} AND injury_type IS NOT NULL AND injury_type != ''
        GROUP BY injury_type ORDER BY count DESC
      `),
      db.execute(sql`
        SELECT shift_type AS position, COUNT(*)::int AS count
        FROM claims WHERE ${notDeleted} AND shift_type IS NOT NULL AND shift_type != ''
        GROUP BY shift_type ORDER BY count DESC
      `),
      db.execute(sql`
        SELECT pro_id, MIN(first_name || ' ' || last_name) AS name, COUNT(*)::int AS count
        FROM claims WHERE ${notDeleted} AND pro_id IS NOT NULL AND pro_id != ''
        GROUP BY pro_id HAVING COUNT(*) > 1
        ORDER BY count DESC
      `),
    ]);

    const t = (totals as any).rows[0];
    const monthList = ((monthRows as any).rows as any[]).reverse();

    return {
      totalClaims: t.total_claims,
      totalOpen: t.total_open,
      totalClosed: t.total_closed,
      totalIncurred: t.total_incurred,
      totalPayments: t.total_payments,
      totalOutstanding: t.total_outstanding,
      totalMedical: t.total_medical,
      totalLAE: t.total_lae,
      inLitigation: t.in_litigation,
      w2Claims: t.w2_claims,
      ioccClaims: t.iocc_claims,
      statusBreakdown: ((statusRows as any).rows as any[]).map(r => ({ status: r.status, count: r.count })),
      stageBreakdown: ((stageRows as any).rows as any[]).map(r => ({ stage: r.stage, count: r.count })),
      monthlyBreakdown: monthList.map((r: any) => ({ month: r.month, count: r.total })),
      workerTypeMonthly: monthList.map((r: any) => ({ month: r.month, w2: r.w2, iocc: r.iocc })),
      byState: ((stateRows as any).rows as any[]).map(r => ({ state: r.state, count: r.count })),
      byInjuryType: ((injuryRows as any).rows as any[]).map(r => ({ type: r.type, count: r.count })),
      byPosition: ((posRows as any).rows as any[]).map(r => ({ position: r.position, count: r.count })),
      repeatPros: ((proRows as any).rows as any[]).map(r => ({ proId: r.pro_id, name: r.name, count: r.count })),
    };
  }

  async getFinancials(): Promise<FinancialsData> {
    const notDeleted = sql`deleted_at IS NULL`;
    const incurredExpr = sql`GREATEST(COALESCE(losses_paid,0), COALESCE(medical_total,0)) + COALESCE(loss_adjusting_expenses,0) + COALESCE(total_outstanding,0) + COALESCE(total_payments,0)`;
    const bucketSelect = sql`
      COUNT(*)::int AS claim_count,
      COUNT(*) FILTER (WHERE claim_status = 'Open')::int AS open_count,
      COUNT(*) FILTER (WHERE claim_status = 'Closed')::int AS closed_count,
      COUNT(*) FILTER (WHERE worker_type = 'W2')::int AS w2_count,
      COUNT(*) FILTER (WHERE worker_type = '1099')::int AS iocc_count,
      ROUND(COALESCE(SUM(COALESCE(losses_paid,0)),0)::numeric, 2)::float AS losses_paid,
      ROUND(COALESCE(SUM(COALESCE(medical_total,0)),0)::numeric, 2)::float AS medical_incurred,
      ROUND(COALESCE(SUM(COALESCE(loss_adjusting_expenses,0)),0)::numeric, 2)::float AS lae,
      ROUND(COALESCE(SUM(COALESCE(total_outstanding,0)),0)::numeric, 2)::float AS reserves,
      ROUND(COALESCE(SUM(${incurredExpr}),0)::numeric, 2)::float AS total_incurred
    `;

    const toBucket = (label: string, r: any): FinancialBucket => ({
      label,
      claimCount: r.claim_count,
      openCount: r.open_count,
      closedCount: r.closed_count,
      w2Count: r.w2_count,
      ioccCount: r.iocc_count,
      lossesPaid: r.losses_paid,
      medicalIncurred: r.medical_incurred,
      lae: r.lae,
      reserves: r.reserves,
      totalIncurred: r.total_incurred,
    });

    const policyYearExpr = sql`
      CASE WHEN date_of_injury >= MAKE_DATE(EXTRACT(YEAR FROM date_of_injury)::int, 4, 30)
           THEN EXTRACT(YEAR FROM date_of_injury)::int || '-' || (EXTRACT(YEAR FROM date_of_injury)::int + 1)
           ELSE (EXTRACT(YEAR FROM date_of_injury)::int - 1) || '-' || EXTRACT(YEAR FROM date_of_injury)::int
      END
    `;

    const [openRes, allRes, calRes, polRes, wtRes, topRes] = await Promise.all([
      db.execute(sql`SELECT ${bucketSelect} FROM claims WHERE ${notDeleted} AND claim_status = 'Open'`),
      db.execute(sql`SELECT ${bucketSelect} FROM claims WHERE ${notDeleted}`),
      db.execute(sql`
        SELECT EXTRACT(YEAR FROM date_of_injury)::int AS yr, ${bucketSelect}
        FROM claims WHERE ${notDeleted} AND date_of_injury IS NOT NULL
        GROUP BY yr ORDER BY yr
      `),
      db.execute(sql`
        SELECT ${policyYearExpr} AS py, ${bucketSelect}
        FROM claims WHERE ${notDeleted} AND date_of_injury IS NOT NULL
        GROUP BY py ORDER BY py
      `),
      db.execute(sql`
        SELECT worker_type AS wt, ${bucketSelect}
        FROM claims WHERE ${notDeleted}
        GROUP BY worker_type ORDER BY worker_type
      `),
      db.execute(sql`
        SELECT id, first_name || ' ' || last_name AS name, pro_id,
               injury_type, date_of_injury, worker_type,
               (${incurredExpr})::float AS total_incurred,
               COALESCE(losses_paid, 0)::float AS losses_paid,
               COALESCE(medical_total, 0)::float AS medical_incurred
        FROM claims WHERE ${notDeleted} AND (${incurredExpr}) > 0
        ORDER BY total_incurred DESC LIMIT 20
      `),
    ]);

    const openRow = (openRes as any).rows[0];
    const allRow = (allRes as any).rows[0];

    return {
      openSummary: toBucket("Open Claims", openRow),
      allSummary: toBucket("All Claims", allRow),
      byCalendarYear: ((calRes as any).rows as any[]).map(r => toBucket(String(r.yr), r)),
      byPolicyYear: ((polRes as any).rows as any[]).map(r => toBucket(r.py, r)),
      byWorkerType: ((wtRes as any).rows as any[]).map(r => toBucket(r.wt, r)),
      topClaimsByIncurred: ((topRes as any).rows as any[]).map(r => ({
        id: r.id,
        name: r.name?.trim() || "",
        proId: r.pro_id || "",
        injuryType: r.injury_type || "",
        dateOfInjury: r.date_of_injury || "",
        workerType: r.worker_type || "",
        totalIncurred: r.total_incurred,
        lossesPaid: r.losses_paid,
        medicalIncurred: r.medical_incurred,
      })),
    };
  }

  // --- Companies ---

  async getCompanies(): Promise<Company[]> {
    return db.select().from(companies).orderBy(companies.type, companies.name);
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const [created] = await db.insert(companies).values(data).returning();
    return created;
  }

  async updateCompany(id: number, data: Partial<InsertCompany>): Promise<Company | undefined> {
    const [updated] = await db.update(companies).set(data).where(eq(companies.id, id)).returning();
    return updated;
  }

  async deleteCompany(id: number): Promise<void> {
    await db.delete(companies).where(eq(companies.id, id));
  }

  // --- Insurance Policies ---

  async getPolicies(): Promise<InsurancePolicy[]> {
    return db.select().from(insurancePolicies).orderBy(insurancePolicies.status, desc(insurancePolicies.policyYearEnd));
  }

  async createPolicy(data: InsertPolicy): Promise<InsurancePolicy> {
    const [created] = await db.insert(insurancePolicies).values(data).returning();
    return created;
  }

  async updatePolicy(id: number, data: Partial<InsertPolicy>): Promise<InsurancePolicy | undefined> {
    const [updated] = await db.update(insurancePolicies).set({ ...data, updatedAt: new Date() }).where(eq(insurancePolicies.id, id)).returning();
    return updated;
  }

  async deletePolicy(id: number): Promise<void> {
    await db.delete(insurancePolicies).where(eq(insurancePolicies.id, id));
  }

  async getApplicablePolicy(workerType: string, dateOfInjury: string, litigated: boolean): Promise<{
    policy: InsurancePolicy | null;
    coverageType: string;
    coverageNote: string;
  }> {
    let policyType: string;
    let coverageType: string;
    let coverageNote: string;

    if (workerType === "W2") {
      policyType = "Workers Comp";
      coverageType = "Workers' Compensation";
      coverageNote = "Statutory WC coverage for W2 shift workers and corporate employees";
    } else {
      policyType = "Occupational Accident";
      if (litigated) {
        coverageType = "Contingent Liability (via OccAcc)";
        coverageNote = "1099 Pro filed a WC claim — Contingent Liability coverage applies, underwritten by the OccAcc carrier";
      } else {
        coverageType = "Occupational Accident";
        coverageNote = "Accident medical coverage for 1099 shift workers";
      }
    }

    const allOfType = await db.select().from(insurancePolicies)
      .where(eq(insurancePolicies.policyType, policyType))
      .orderBy(desc(insurancePolicies.policyYearEnd));

    const injury = new Date(dateOfInjury);
    const matched = allOfType.find((p) => {
      if (!p.policyYearStart || !p.policyYearEnd) return false;
      const start = new Date(p.policyYearStart);
      const end = new Date(p.policyYearEnd);
      return injury >= start && injury <= end;
    });

    return { policy: matched || null, coverageType, coverageNote };
  }
}

export const storage = new DatabaseStorage();
