/**
 * Match missing Pro IDs using shift data (DOI + partner) + name matching.
 * Database is updated ONLY for high-confidence matches:
 *   - Exactly one worker on that shift with strong name match (fn≥0.9, ln≥0.9), or
 *   - Exactly one worker on that shift with loose name match (fn≥0.8, ln≥0.9).
 * Near matches (e.g. score 0.6–0.8) are never written to the DB — they are logged for manual review only.
 */
import { db, pool } from "../db";
import { claims } from "@shared/schema";
import { executeRedshiftQuery } from "../redshift";
import { sql, eq } from "drizzle-orm";
import { pros } from "@shared/schema";

const EXECUTE = process.argv.includes("--execute");

interface ClaimRow {
  id: number;
  matterNumber: string | null;
  firstName: string;
  lastName: string;
  dateOfInjury: string;
  stateOfInjury: string | null;
  partnerName: string | null;
}

interface ShiftWorker {
  workerId: number;
  givenName: string | null;
  familyName: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  workerRegion: string | null;
  workerStatus: string | null;
  address: string | null;
  locality: string | null;
  state: string | null;
  stateCode: string | null;
  zipcode: string | null;
  workerLevel: string | null;
  w2Eligible: boolean;
  w2Employer: string | null;
  w2Status: number | null;
  backgroundCheckStatus: number | null;
  noshowCount: number | null;
  dateCreated: string | null;
  lastActive: string | null;
}

function sanitize(s: string): string {
  return s.replace(/'/g, "''").trim();
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

function nameSimilarity(a: string, b: string): number {
  const an = normalize(a);
  const bn = normalize(b);
  if (an === bn) return 1;
  if (an.includes(bn) || bn.includes(an)) return 0.8;
  let matches = 0;
  const shorter = an.length <= bn.length ? an : bn;
  const longer = an.length > bn.length ? an : bn;
  for (const ch of shorter) {
    const idx = longer.indexOf(ch);
    if (idx !== -1) matches++;
  }
  return matches / Math.max(an.length, bn.length);
}

async function findShiftWorkers(dateOfInjury: string, partnerName: string | null): Promise<ShiftWorker[]> {
  const safeDate = sanitize(dateOfInjury);
  const nextDay = new Date(dateOfInjury);
  nextDay.setDate(nextDay.getDate() + 1);
  const safeNextDay = nextDay.toISOString().split("T")[0];

  let partnerClause = "";
  if (partnerName) {
    const safeName = sanitize(partnerName);
    partnerClause = `AND LOWER(g.business_name) LIKE LOWER('%${safeName.substring(0, Math.min(safeName.length, 20))}%')`;
  }

  const query = `
    SELECT DISTINCT g.worker_id, u.given_name, u.family_name, u.name, u.email, u.phonenum AS phone,
           g.business_name, g.worker_region_name,
           u.worker_status, u.address, u.locality, u.state, u.state_code,
           u.zipcode, u.worker_level, u.w2_eligible, u.w2_employer,
           u.w2_status, u.background_check_status, u.noshow_count,
           u.date_created, u.last_active
    FROM iw_backend_db.gigs_view g
    JOIN iw_backend_db.backend_userprofile u ON g.worker_id = u.id
    WHERE g.starts_at >= '${safeDate}'
      AND g.starts_at < '${safeNextDay}'
      AND g.is_cancelled = 0
      ${partnerClause}
    LIMIT 500
  `;

  const { columns, rows } = await executeRedshiftQuery(query);
  if (rows.length === 0) return [];

  const ci = Object.fromEntries(columns.map((c, i) => [c, i]));
  return rows.map((r) => ({
    workerId: r[ci.worker_id] as number,
    givenName: r[ci.given_name] as string | null,
    familyName: r[ci.family_name] as string | null,
    name: r[ci.name] as string | null,
    email: r[ci.email] as string | null,
    phone: r[ci.phone] as string | null,
    businessName: r[ci.business_name] as string | null,
    workerRegion: r[ci.worker_region_name] as string | null,
    workerStatus: r[ci.worker_status] as string | null,
    address: r[ci.address] as string | null,
    locality: r[ci.locality] as string | null,
    state: r[ci.state] as string | null,
    stateCode: r[ci.state_code] as string | null,
    zipcode: r[ci.zipcode] as string | null,
    workerLevel: r[ci.worker_level] as string | null,
    w2Eligible: r[ci.w2_eligible] === 1,
    w2Employer: r[ci.w2_employer] as string | null,
    w2Status: r[ci.w2_status] as number | null,
    backgroundCheckStatus: r[ci.background_check_status] as number | null,
    noshowCount: r[ci.noshow_count] as number | null,
    dateCreated: r[ci.date_created] as string | null,
    lastActive: r[ci.last_active] as string | null,
  }));
}

async function upsertPro(w: ShiftWorker) {
  await db.insert(pros).values({
    proId: w.workerId,
    name: w.name,
    givenName: w.givenName,
    familyName: w.familyName,
    email: w.email,
    phone: w.phone,
    address: w.address,
    locality: w.locality,
    state: w.state,
    stateCode: w.stateCode,
    zipcode: w.zipcode,
    workerStatus: w.workerStatus,
    workerLevel: w.workerLevel,
    w2Eligible: w.w2Eligible,
    w2Employer: w.w2Employer,
    w2Status: w.w2Status,
    backgroundCheckStatus: w.backgroundCheckStatus,
    noshowCount: w.noshowCount,
    dateCreated: w.dateCreated ? new Date(w.dateCreated) : null,
    lastActive: w.lastActive ? new Date(w.lastActive) : null,
    syncedAt: new Date(),
  }).onConflictDoUpdate({
    target: pros.proId,
    set: {
      name: sql`excluded.name`,
      givenName: sql`excluded.given_name`,
      familyName: sql`excluded.family_name`,
      email: sql`excluded.email`,
      phone: sql`excluded.phone`,
      address: sql`excluded.address`,
      locality: sql`excluded.locality`,
      state: sql`excluded.state`,
      stateCode: sql`excluded.state_code`,
      zipcode: sql`excluded.zipcode`,
      workerStatus: sql`excluded.worker_status`,
      workerLevel: sql`excluded.worker_level`,
      w2Eligible: sql`excluded.w2_eligible`,
      w2Employer: sql`excluded.w2_employer`,
      w2Status: sql`excluded.w2_status`,
      backgroundCheckStatus: sql`excluded.background_check_status`,
      noshowCount: sql`excluded.noshow_count`,
      dateCreated: sql`excluded.date_created`,
      lastActive: sql`excluded.last_active`,
      syncedAt: sql`excluded.synced_at`,
    },
  });
}

async function run() {
  console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY RUN"}\n`);

  const missing = await db.select({
    id: claims.id,
    matterNumber: claims.matterNumber,
    firstName: claims.firstName,
    lastName: claims.lastName,
    dateOfInjury: claims.dateOfInjury,
    stateOfInjury: claims.stateOfInjury,
    partnerName: claims.partnerName,
  }).from(claims)
    .where(sql`(pro_id IS NULL OR pro_id = '') AND deleted_at IS NULL`)
    .orderBy(claims.lastName, claims.firstName);

  console.log(`Found ${missing.length} claims still missing Pro ID\n`);

  let shiftMatched = 0;
  let shiftAmbiguous = 0;
  let noShiftData = 0;
  let errorCount = 0;
  const stillUnresolved: { claim: ClaimRow; reason: string; candidates?: string[]; nearMatch?: string[] }[] = [];

  for (let i = 0; i < missing.length; i++) {
    const claim = missing[i];
    const label = `${claim.matterNumber || "#" + claim.id} (${claim.lastName}, ${claim.firstName} | DOI: ${claim.dateOfInjury} | ${claim.stateOfInjury || "?"} | ${claim.partnerName || "no partner"})`;

    if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${missing.length}`);

    let workers: ShiftWorker[];
    try {
      // First try with partner name to narrow results
      workers = claim.partnerName
        ? await findShiftWorkers(claim.dateOfInjury, claim.partnerName)
        : [];

      // If no results with partner, try date-only
      if (workers.length === 0) {
        workers = await findShiftWorkers(claim.dateOfInjury, null);
      }
    } catch (err: any) {
      errorCount++;
      stillUnresolved.push({ claim, reason: `error: ${err.message}` });
      continue;
    }

    if (workers.length === 0) {
      noShiftData++;
      stillUnresolved.push({ claim, reason: "no shifts found on DOI" });
      continue;
    }

    // Among workers on this shift (DOI+partner), find who matches the claimant's name.
    // Even if multiple workers on the shift, exactly one name match → that's the worker.
    const scored = workers.map((w) => {
      const fnScore = Math.max(
        nameSimilarity(claim.firstName, w.givenName || ""),
        nameSimilarity(claim.firstName, (w.name || "").split(" ")[0] || "")
      );
      const lnScore = Math.max(
        nameSimilarity(claim.lastName, w.familyName || ""),
        nameSimilarity(claim.lastName, (w.name || "").split(" ").slice(1).join(" ") || "")
      );
      return { worker: w, score: (fnScore + lnScore) / 2, fnScore, lnScore };
    });

    // Strong match: both first and last name must be exact or near-exact
    const strong = scored.filter((s) => s.fnScore >= 0.9 && s.lnScore >= 0.9);

    if (strong.length === 1) {
      shiftMatched++;
      const w = strong[0].worker;
      console.log(`  SHIFT-MATCH  ${label} → Pro ${w.workerId} (${w.name}, ${w.workerStatus}, worked at ${w.businessName})`);
      if (EXECUTE) {
        await upsertPro(w);
        // High-confidence: single strong name match on shift — safe to persist
        await db.update(claims).set({ proId: String(w.workerId) }).where(eq(claims.id, claim.id));
      }
    } else if (strong.length > 1) {
      shiftAmbiguous++;
      const near = scored.filter((s) => s.fnScore >= 0.6 && s.lnScore >= 0.6 && !(s.fnScore >= 0.9 && s.lnScore >= 0.9)).sort((a, b) => b.score - a.score).slice(0, 3);
      stillUnresolved.push({
        claim,
        reason: `${strong.length} shift workers match name`,
        candidates: strong.map((s) => `Pro ${s.worker.workerId} (${s.worker.name}, ${s.worker.workerStatus}, ${s.worker.businessName})`),
        nearMatch: near.map((s) => `[NEAR] Pro ${s.worker.workerId} (${s.worker.name}, score=${s.score.toFixed(2)}, ${s.worker.businessName})`),
      });
    } else {
      // Slightly looser: both names >= 0.8 (handles nicknames like Jackie/Jacqueline, Jeff/Jeffrey)
      const loose = scored.filter((s) => s.fnScore >= 0.8 && s.lnScore >= 0.9).sort((a, b) => b.score - a.score);
      if (loose.length === 1) {
        shiftMatched++;
        const w = loose[0].worker;
        console.log(`  SHIFT-MATCH (close)  ${label} → Pro ${w.workerId} (${w.name}, fn=${loose[0].fnScore.toFixed(2)} ln=${loose[0].lnScore.toFixed(2)}, ${w.businessName})`);
        if (EXECUTE) {
          await upsertPro(w);
          // High-confidence: single loose name match on shift (e.g. nickname) — safe to persist
          await db.update(claims).set({ proId: String(w.workerId) }).where(eq(claims.id, claim.id));
        }
      } else {
        noShiftData++;
        const topCandidates = scored
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .filter((s) => s.score > 0.4);
        const near = scored.filter((s) => s.fnScore >= 0.6 && s.lnScore >= 0.6 && s.score < 0.8).sort((a, b) => b.score - a.score).slice(0, 3);
        stillUnresolved.push({
          claim,
          reason: topCandidates.length > 0
            ? `no strong name match among ${workers.length} shift workers`
            : "no shifts found matching name",
          candidates: topCandidates.map((s) =>
            `Pro ${s.worker.workerId} (${s.worker.name}, fn=${s.fnScore.toFixed(2)} ln=${s.lnScore.toFixed(2)}, ${s.worker.businessName})`
          ),
          nearMatch: near.map((s) => `[NEAR] Pro ${s.worker.workerId} (${s.worker.name}, score=${s.score.toFixed(2)}, ${s.worker.businessName})`),
        });
      }
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Total remaining:     ${missing.length}`);
  console.log(`Shift-matched:       ${shiftMatched}`);
  console.log(`Shift-ambiguous:     ${shiftAmbiguous}`);
  console.log(`No shift/name match: ${noShiftData}`);
  console.log(`Errors:              ${errorCount}`);
  console.log(`Still unresolved:    ${stillUnresolved.length}`);

  if (stillUnresolved.length > 0) {
    console.log("\n--- Still unresolved ---");
    for (const u of stillUnresolved) {
      const c = u.claim;
      console.log(`\n  ${c.matterNumber || "#" + c.id} | ${c.lastName}, ${c.firstName} | DOI: ${c.dateOfInjury} | ${c.stateOfInjury || "?"} | Partner: ${c.partnerName || "?"}`);
      console.log(`    Reason: ${u.reason}`);
      if (u.candidates) {
        u.candidates.forEach((cd) => console.log(`    → ${cd}`));
      }
      if (u.nearMatch && u.nearMatch.length > 0) {
        u.nearMatch.forEach((n) => console.log(`    ${n}`));
      }
    }
  }

  if (!EXECUTE && shiftMatched > 0) {
    console.log(`\n(Dry run — run with --execute to apply ${shiftMatched} matches.)`);
  }
}

run()
  .then(() => { pool.end(); process.exit(0); })
  .catch((err) => { console.error("Failed:", err); pool.end(); process.exit(1); });
