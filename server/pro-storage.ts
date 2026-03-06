import { db } from "./db";
import { pros, proShifts, claims, type Pro, type ProShift } from "@shared/schema";
import { eq, ilike, or, sql, count, desc, and, isNull } from "drizzle-orm";
import { executeRedshiftQuery } from "./redshift";

function sanitizeInt(val: number): number {
  const n = Math.floor(val);
  if (!Number.isFinite(n) || n < 0) throw new Error("Invalid numeric ID");
  return n;
}

function sanitizeStr(val: string): string {
  return val.replace(/'/g, "''").replace(/[\\;]/g, "").slice(0, 200);
}

const SYNCED_MONTH_TTL_MS = 60 * 60 * 1000; // 1 hour

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const GEOCODE_CACHE_MAX = 1000;

class ProStorage {
  private syncedMonths = new Map<string, number>();
  private geocodeCache = new Map<string, { city: string | null; state: string | null; address: string | null } | null>();
  private lastGeocodeTick = 0;

  private evictGeocodeCache(): void {
    if (this.geocodeCache.size <= GEOCODE_CACHE_MAX) return;
    const toRemove = this.geocodeCache.size - GEOCODE_CACHE_MAX;
    const keys = this.geocodeCache.keys();
    for (let i = 0; i < toRemove; i++) {
      const { value } = keys.next();
      if (value) this.geocodeCache.delete(value);
    }
  }

  async getPro(proId: number): Promise<Pro | null> {
    const [local] = await db.select().from(pros).where(eq(pros.proId, proId));
    if (local) return local;

    try {
      return await this.fetchAndCacheFromRedshift(proId);
    } catch (err) {
      console.error("Redshift lookup failed, Pro not found locally:", err);
      return null;
    }
  }

  async searchPros(query: string): Promise<Pro[]> {
    const digitsOnly = query.replace(/[\s()\-\.]/g, "");
    const isProId = /^\d+$/.test(digitsOnly) && digitsOnly.length >= 6 && !query.includes("(") && !query.includes("-");

    if (isProId) {
      const exactId = parseInt(digitsOnly, 10);
      const [local] = await db.select().from(pros).where(eq(pros.proId, exactId));
      if (local) return [local];

      try {
        const pro = await this.fetchAndCacheFromRedshift(exactId);
        return pro ? [pro] : [];
      } catch {
        return [];
      }
    }

    const looksLikePhone = /[\d()\-]/.test(query) && digitsOnly.length >= 3;
    const words = query.split(/\s+/).filter(Boolean);
    const TRGM_THRESHOLD = 0.3;

    let localWhere;
    let similarityScore;

    if (looksLikePhone) {
      localWhere = or(
        ilike(pros.phone, `%${query}%`),
        ilike(pros.phone, `%${digitsOnly}%`),
        ilike(pros.name, `%${query}%`),
        ilike(pros.givenName, `%${query}%`),
        ilike(pros.familyName, `%${query}%`),
        ilike(pros.email, `%${query}%`)
      )!;
      similarityScore = sql<number>`0`;
    } else if (words.length > 1) {
      const firstName = words[0];
      const lastName = words.slice(1).join(" ");
      localWhere = sql`(
        (${ilike(pros.givenName, `%${firstName}%`)} AND ${ilike(pros.familyName, `%${lastName}%`)})
        OR ${ilike(pros.name, `%${query}%`)}
        OR ${ilike(pros.email, `%${query}%`)}
        OR (similarity(${pros.givenName}, ${firstName}) > ${TRGM_THRESHOLD}
            AND similarity(${pros.familyName}, ${lastName}) > ${TRGM_THRESHOLD})
      )`;
      similarityScore = sql<number>`(
        COALESCE(similarity(${pros.givenName}, ${firstName}), 0)
        + COALESCE(similarity(${pros.familyName}, ${lastName}), 0)
      )`;
    } else {
      localWhere = sql`(
        ${ilike(pros.name, `%${query}%`)}
        OR ${ilike(pros.givenName, `%${query}%`)}
        OR ${ilike(pros.familyName, `%${query}%`)}
        OR ${ilike(pros.email, `%${query}%`)}
        OR ${ilike(pros.phone, `%${query}%`)}
        OR similarity(${pros.givenName}, ${query}) > ${TRGM_THRESHOLD}
        OR similarity(${pros.familyName}, ${query}) > ${TRGM_THRESHOLD}
        OR similarity(${pros.name}, ${query}) > ${TRGM_THRESHOLD}
      )`;
      similarityScore = sql<number>`GREATEST(
        COALESCE(similarity(${pros.givenName}, ${query}), 0),
        COALESCE(similarity(${pros.familyName}, ${query}), 0),
        COALESCE(similarity(${pros.name}, ${query}), 0)
      )`;
    }

    const localResults = await db
      .select()
      .from(pros)
      .where(localWhere)
      .orderBy(desc(similarityScore))
      .limit(20);

    if (localResults.length >= 5) return localResults;

    try {
      const redshiftResults = await this.searchRedshift(query);
      const merged = new Map<number, Pro>();
      for (const r of localResults) merged.set(r.proId, r);
      for (const r of redshiftResults) {
        if (!merged.has(r.proId)) merged.set(r.proId, r);
      }
      return Array.from(merged.values()).slice(0, 20);
    } catch (err) {
      console.error("Redshift search failed, returning local results:", err);
      return localResults;
    }
  }

  async getStats() {
    const [{ value }] = await db.select({ value: count() }).from(pros);
    const [latest] = await db
      .select({ syncedAt: pros.syncedAt })
      .from(pros)
      .orderBy(sql`${pros.syncedAt} DESC NULLS LAST`)
      .limit(1);

    return {
      totalCached: value,
      lastSyncedAt: latest?.syncedAt || null,
    };
  }

  private async fetchAndCacheFromRedshift(proId: number): Promise<Pro | null> {
    const safeId = sanitizeInt(proId);
    const { columns, rows } = await executeRedshiftQuery(`
      SELECT id AS pro_id, name, given_name, family_name, email,
             phonenum AS phone, address, locality, state, state_code,
             zipcode, worker_status, worker_level, w2_eligible, w2_employer,
             w2_status, background_check_status, noshow_count,
             date_created, last_active
      FROM iw_backend_db.backend_userprofile
      WHERE id = ${safeId}
    `);

    if (rows.length === 0) return null;

    const colIndex = Object.fromEntries(columns.map((c, i) => [c, i]));
    const row = rows[0];
    const value = this.rowToInsert(row, colIndex);

    const [inserted] = await db
      .insert(pros)
      .values(value)
      .onConflictDoUpdate({
        target: pros.proId,
        set: { ...value, syncedAt: new Date() },
      })
      .returning();

    return inserted;
  }

  private async searchRedshift(query: string): Promise<Pro[]> {
    const escaped = sanitizeStr(query);
    const escapedDigits = escaped.replace(/[\s()\-\.]/g, "");
    const words = escaped.split(/\s+/).filter(Boolean).map(w => sanitizeStr(w));

    const fuzzyPrefix = (word: string) =>
      word.length >= 4 ? word.slice(0, -1) : word;

    let nameFilter: string;
    if (words.length > 1) {
      const first = words[0];
      const last = words.slice(1).join(" ");
      const firstFuzzy = fuzzyPrefix(first);
      const lastFuzzy = fuzzyPrefix(last);
      nameFilter = [
        `(given_name ILIKE '%${first}%' AND family_name ILIKE '%${last}%')`,
        `(given_name ILIKE '%${firstFuzzy}%' AND family_name ILIKE '%${lastFuzzy}%')`,
        `name ILIKE '%${escaped}%'`,
      ].join(" OR ");
    } else {
      nameFilter = `name ILIKE '%${escaped}%' OR given_name ILIKE '%${escaped}%' OR family_name ILIKE '%${escaped}%' OR email ILIKE '%${escaped}%' OR phonenum ILIKE '%${escaped}%'`;
      if (escaped.length >= 4) {
        const prefix = fuzzyPrefix(escaped);
        nameFilter += ` OR given_name ILIKE '%${prefix}%' OR family_name ILIKE '%${prefix}%'`;
      }
      if (escapedDigits.length >= 3) {
        nameFilter += ` OR phonenum ILIKE '%${escapedDigits}%'`;
      }
    }

    const { columns, rows } = await executeRedshiftQuery(`
      SELECT id AS pro_id, name, given_name, family_name, email,
             phonenum AS phone, address, locality, state, state_code,
             zipcode, worker_status, worker_level, w2_eligible, w2_employer,
             w2_status, background_check_status, noshow_count,
             date_created, last_active
      FROM iw_backend_db.backend_userprofile
      WHERE is_internal_user = 0
        AND worker_status NOT IN ('DELETED')
        AND (${nameFilter})
      ORDER BY last_active DESC NULLS LAST
      LIMIT 20
    `);

    const colIndex = Object.fromEntries(columns.map((c, i) => [c, i]));
    const results: Pro[] = [];

    for (const row of rows) {
      const value = this.rowToInsert(row, colIndex);
      const [upserted] = await db
        .insert(pros)
        .values(value)
        .onConflictDoUpdate({
          target: pros.proId,
          set: { ...value, syncedAt: new Date() },
        })
        .returning();
      results.push(upserted);
    }

    return results;
  }

  async getOpenClaims(proId: number) {
    return db
      .select({
        id: claims.id,
        dateOfInjury: claims.dateOfInjury,
        partnerName: claims.partnerName,
        claimStatus: claims.claimStatus,
        injuryType: claims.injuryType,
      })
      .from(claims)
      .where(and(eq(claims.proId, String(proId)), eq(claims.claimStatus, "Open"), isNull(claims.deletedAt)));
  }

  async getShiftStats(proId: number): Promise<{
    totalShifts: number;
    w2Shifts: number;
    nonW2Shifts: number;
  }> {
    let totalShifts = 0;
    let w2Shifts = 0;
    let nonW2Shifts = 0;

    try {
      const safeId = sanitizeInt(proId);
      const { rows } = await executeRedshiftQuery(`
        SELECT
          COUNT(*) AS total_shifts,
          SUM(CASE WHEN t.w2_employees_only = 1 THEN 1 ELSE 0 END) AS w2_shifts,
          SUM(CASE WHEN t.w2_employees_only = 0 THEN 1 ELSE 0 END) AS non_w2_shifts
        FROM iw_backend_db.gigs_view g
        LEFT JOIN iw_backend_db.backend_gigtemplate t ON g.gig_template_id = t.id
        WHERE g.worker_id = ${safeId}
          AND g.is_cancelled = 0
          AND g.starts_at IS NOT NULL
      `);
      if (rows.length > 0) {
        totalShifts = Number(rows[0][0]) || 0;
        w2Shifts = Number(rows[0][1]) || 0;
        nonW2Shifts = Number(rows[0][2]) || 0;
      }
    } catch (err) {
      console.error("Redshift shift count query failed:", err);
    }

    return { totalShifts, w2Shifts, nonW2Shifts };
  }

  async getProShifts(proId: number, limit = 10): Promise<ProShift[]> {
    const cached = await db
      .select()
      .from(proShifts)
      .where(eq(proShifts.proId, proId))
      .orderBy(desc(proShifts.startsAt))
      .limit(limit);

    if (cached.length > 0) return cached;

    try {
      return await this.fetchAndCacheShifts(proId, limit);
    } catch (err) {
      console.error("Redshift shift lookup failed:", err);
      return [];
    }
  }

  async getProShiftsByMonth(proId: number, month: string): Promise<ProShift[]> {
    const startDate = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const cacheKey = `${proId}:${month}`;

    const syncedAt = this.syncedMonths.get(cacheKey);
    if (syncedAt && Date.now() - syncedAt < SYNCED_MONTH_TTL_MS) {
      return db
        .select()
        .from(proShifts)
        .where(
          and(
            eq(proShifts.proId, proId),
            sql`${proShifts.startsAt} >= ${startDate}::timestamp`,
            sql`${proShifts.startsAt} < ${endDate}::timestamp`,
          )
        )
        .orderBy(desc(proShifts.startsAt));
    }

    try {
      const result = await this.fetchAndCacheShiftsByMonth(proId, startDate, endDate);
      this.syncedMonths.set(cacheKey, Date.now());
      if (this.syncedMonths.size > 200) {
        const now = Date.now();
        for (const [k, t] of this.syncedMonths) {
          if (now - t > SYNCED_MONTH_TTL_MS) this.syncedMonths.delete(k);
        }
      }
      return result;
    } catch (err) {
      console.error("Redshift month shift lookup failed:", err);
      return [];
    }
  }

  private async fetchAndCacheShiftsByMonth(proId: number, startDate: string, endDate: string): Promise<ProShift[]> {
    const safeId = sanitizeInt(proId);
    const safeStart = sanitizeStr(startDate);
    const safeEnd = sanitizeStr(endDate);
    const { columns, rows } = await executeRedshiftQuery(`
      SELECT g.shift_id, g.business_name, g.gig_position, g.starts_at, g.ends_at,
             g.status, g.biz_region_name, g.worker_region_name,
             g.worker_sub_region_name, g.worker_zipcode,
             g.is_cancelled, t.geocode AS template_geocode,
             t.w2_employees_only
      FROM iw_backend_db.gigs_view g
      LEFT JOIN iw_backend_db.backend_gigtemplate t
        ON g.gig_template_id = t.id
      WHERE g.worker_id = ${safeId}
        AND g.is_cancelled = 0
        AND g.starts_at >= '${safeStart}'
        AND g.starts_at < '${safeEnd}'
      ORDER BY g.starts_at DESC
    `);

    if (rows.length === 0) return [];

    const colIndex = Object.fromEntries(columns.map((c, i) => [c, i]));

    const values = await Promise.all(rows.map(async (row) => {
      const geocodeStr = row[colIndex.template_geocode] as string | null;
      let shiftCity: string | null = null;
      let shiftState: string | null = null;
      let shiftAddress: string | null = null;

      if (geocodeStr) {
        const geo = await this.reverseGeocode(geocodeStr);
        if (geo) {
          shiftCity = geo.city;
          shiftState = geo.state;
          shiftAddress = geo.address;
        }
      }

      return {
        shiftId: row[colIndex.shift_id] as number,
        proId,
        businessName: row[colIndex.business_name] as string | null,
        position: row[colIndex.gig_position] as string | null,
        startsAt: row[colIndex.starts_at] ? new Date(row[colIndex.starts_at] as string) : null,
        endsAt: row[colIndex.ends_at] ? new Date(row[colIndex.ends_at] as string) : null,
        status: row[colIndex.status] as string | null,
        regionName: row[colIndex.biz_region_name] as string | null,
        workerRegionName: row[colIndex.worker_region_name] as string | null,
        subRegionName: row[colIndex.worker_sub_region_name] as string | null,
        zipcode: row[colIndex.worker_zipcode] as string | null,
        geocode: geocodeStr,
        shiftCity,
        shiftState,
        shiftAddress,
        isW2: row[colIndex.w2_employees_only] === 1 || row[colIndex.w2_employees_only] === "1" ? true : false,
        syncedAt: new Date(),
      };
    }));

    await db
      .insert(proShifts)
      .values(values)
      .onConflictDoNothing();

    return db
      .select()
      .from(proShifts)
      .where(
        and(
          eq(proShifts.proId, proId),
          sql`${proShifts.startsAt} >= ${startDate}::timestamp`,
          sql`${proShifts.startsAt} < ${endDate}::timestamp`,
        )
      )
      .orderBy(desc(proShifts.startsAt));
  }

  private async fetchAndCacheShifts(proId: number, limit: number): Promise<ProShift[]> {
    const safeId = sanitizeInt(proId);
    const safeLimit = sanitizeInt(Math.min(limit, 500));
    const { columns, rows } = await executeRedshiftQuery(`
      SELECT g.shift_id, g.business_name, g.gig_position, g.starts_at, g.ends_at,
             g.status, g.biz_region_name, g.worker_region_name,
             g.worker_sub_region_name, g.worker_zipcode,
             g.is_cancelled, t.geocode AS template_geocode,
             t.w2_employees_only
      FROM iw_backend_db.gigs_view g
      LEFT JOIN iw_backend_db.backend_gigtemplate t
        ON g.gig_template_id = t.id
      WHERE g.worker_id = ${safeId}
        AND g.is_cancelled = 0
        AND g.starts_at IS NOT NULL
      ORDER BY g.starts_at DESC
      LIMIT ${safeLimit}
    `);

    if (rows.length === 0) return [];

    const colIndex = Object.fromEntries(columns.map((c, i) => [c, i]));

    const values = await Promise.all(rows.map(async (row) => {
      const geocodeStr = row[colIndex.template_geocode] as string | null;
      let shiftCity: string | null = null;
      let shiftState: string | null = null;
      let shiftAddress: string | null = null;

      if (geocodeStr) {
        const geo = await this.reverseGeocode(geocodeStr);
        if (geo) {
          shiftCity = geo.city;
          shiftState = geo.state;
          shiftAddress = geo.address;
        }
      }

      return {
        shiftId: row[colIndex.shift_id] as number,
        proId,
        businessName: row[colIndex.business_name] as string | null,
        position: row[colIndex.gig_position] as string | null,
        startsAt: row[colIndex.starts_at] ? new Date(row[colIndex.starts_at] as string) : null,
        endsAt: row[colIndex.ends_at] ? new Date(row[colIndex.ends_at] as string) : null,
        status: row[colIndex.status] as string | null,
        regionName: row[colIndex.biz_region_name] as string | null,
        workerRegionName: row[colIndex.worker_region_name] as string | null,
        subRegionName: row[colIndex.worker_sub_region_name] as string | null,
        zipcode: row[colIndex.worker_zipcode] as string | null,
        geocode: geocodeStr,
        shiftCity,
        shiftState,
        shiftAddress,
        isW2: row[colIndex.w2_employees_only] === 1 || row[colIndex.w2_employees_only] === "1" ? true : false,
        syncedAt: new Date(),
      };
    }));

    await db
      .insert(proShifts)
      .values(values)
      .onConflictDoNothing();

    return db
      .select()
      .from(proShifts)
      .where(eq(proShifts.proId, proId))
      .orderBy(desc(proShifts.startsAt))
      .limit(limit);
  }

  private async reverseGeocode(geocode: string): Promise<{ city: string | null; state: string | null; address: string | null } | null> {
    if (this.geocodeCache.has(geocode)) return this.geocodeCache.get(geocode)!;

    const parts = geocode.split(",").map((s) => s.trim());
    if (parts.length !== 2) return null;
    const [lat, lon] = parts;

    const now = Date.now();
    const elapsed = now - this.lastGeocodeTick;
    if (elapsed < 1100) await delay(1100 - elapsed);
    this.lastGeocodeTick = Date.now();

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
      const displayParts = [
        addr.road,
        city,
        state ? `${state} ${addr.postcode || ""}`.trim() : null,
      ].filter(Boolean);
      const address = displayParts.join(", ") || data.display_name || null;

      const result = { city, state: state?.length === 2 ? state : null, address };
      this.geocodeCache.set(geocode, result);
      this.evictGeocodeCache();
      return result;
    } catch (err) {
      console.error("Reverse geocode failed:", err);
      return null;
    }
  }

  private rowToInsert(row: any[], colIndex: Record<string, number>) {
    return {
      proId: row[colIndex.pro_id] as number,
      name: row[colIndex.name] as string | null,
      givenName: row[colIndex.given_name] as string | null,
      familyName: row[colIndex.family_name] as string | null,
      email: row[colIndex.email] as string | null,
      phone: row[colIndex.phone] as string | null,
      address: row[colIndex.address] as string | null,
      locality: row[colIndex.locality] as string | null,
      state: row[colIndex.state] as string | null,
      stateCode: row[colIndex.state_code] as string | null,
      zipcode: row[colIndex.zipcode] as string | null,
      workerStatus: row[colIndex.worker_status] as string | null,
      workerLevel: row[colIndex.worker_level] as string | null,
      w2Eligible: row[colIndex.w2_eligible] === 1,
      w2Employer: row[colIndex.w2_employer] as string | null,
      w2Status: row[colIndex.w2_status] as number | null,
      backgroundCheckStatus: row[colIndex.background_check_status] as number | null,
      noshowCount: row[colIndex.noshow_count] as number | null,
      dateCreated: row[colIndex.date_created] ? new Date(row[colIndex.date_created] as string) : null,
      lastActive: row[colIndex.last_active] ? new Date(row[colIndex.last_active] as string) : null,
      syncedAt: new Date(),
    };
  }
}

export const proStorage = new ProStorage();
