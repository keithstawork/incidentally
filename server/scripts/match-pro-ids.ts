import { db, pool } from "../db";
import { claims, pros } from "@shared/schema";
import { executeRedshiftQuery } from "../redshift";
import { sql, eq } from "drizzle-orm";

const EXECUTE = process.argv.includes("--execute");

interface ClaimRow {
  id: number;
  matterNumber: string | null;
  firstName: string;
  lastName: string;
  dateOfInjury: string;
  stateOfInjury: string | null;
}

interface RedshiftPro {
  proId: number;
  name: string | null;
  givenName: string | null;
  familyName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  locality: string | null;
  state: string | null;
  stateCode: string | null;
  zipcode: string | null;
  workerStatus: string | null;
  workerLevel: string | null;
  w2Eligible: boolean;
  w2Employer: string | null;
  w2Status: number | null;
  backgroundCheckStatus: number | null;
  noshowCount: number | null;
  dateCreated: string | null;
  lastActive: string | null;
}

async function searchRedshiftByName(firstName: string, lastName: string): Promise<RedshiftPro[]> {
  const fn = firstName.replace(/'/g, "''").trim();
  const ln = lastName.replace(/'/g, "''").trim();

  const query = `
    SELECT
      id AS pro_id, name, given_name, family_name, email,
      phonenum AS phone, address, locality, state, state_code,
      zipcode, worker_status, worker_level, w2_eligible, w2_employer,
      w2_status, background_check_status, noshow_count,
      date_created, last_active
    FROM iw_backend_db.backend_userprofile
    WHERE LOWER(TRIM(given_name)) = LOWER('${fn}')
      AND LOWER(TRIM(family_name)) = LOWER('${ln}')
  `;

  const { columns, rows } = await executeRedshiftQuery(query);
  const ci = Object.fromEntries(columns.map((c, i) => [c, i]));

  return rows.map((r) => ({
    proId: r[ci.pro_id] as number,
    name: r[ci.name] as string | null,
    givenName: r[ci.given_name] as string | null,
    familyName: r[ci.family_name] as string | null,
    email: r[ci.email] as string | null,
    phone: r[ci.phone] as string | null,
    address: r[ci.address] as string | null,
    locality: r[ci.locality] as string | null,
    state: r[ci.state] as string | null,
    stateCode: r[ci.state_code] as string | null,
    zipcode: r[ci.zipcode] as string | null,
    workerStatus: r[ci.worker_status] as string | null,
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

async function upsertPro(pro: RedshiftPro) {
  await db.insert(pros).values({
    proId: pro.proId,
    name: pro.name,
    givenName: pro.givenName,
    familyName: pro.familyName,
    email: pro.email,
    phone: pro.phone,
    address: pro.address,
    locality: pro.locality,
    state: pro.state,
    stateCode: pro.stateCode,
    zipcode: pro.zipcode,
    workerStatus: pro.workerStatus,
    workerLevel: pro.workerLevel,
    w2Eligible: pro.w2Eligible,
    w2Employer: pro.w2Employer,
    w2Status: pro.w2Status,
    backgroundCheckStatus: pro.backgroundCheckStatus,
    noshowCount: pro.noshowCount,
    dateCreated: pro.dateCreated ? new Date(pro.dateCreated) : null,
    lastActive: pro.lastActive ? new Date(pro.lastActive) : null,
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

function pickBest(matches: RedshiftPro[], claim: ClaimRow): RedshiftPro | null {
  if (matches.length === 1) return matches[0];

  const active = matches.filter((m) => m.workerStatus === "active");
  if (active.length === 1) return active[0];

  if (claim.stateOfInjury && active.length > 1) {
    const stateMatch = active.filter(
      (m) => m.state?.toUpperCase() === claim.stateOfInjury?.toUpperCase()
    );
    if (stateMatch.length === 1) return stateMatch[0];
  }

  if (claim.stateOfInjury && matches.length > 1) {
    const stateMatch = matches.filter(
      (m) => m.state?.toUpperCase() === claim.stateOfInjury?.toUpperCase()
    );
    if (stateMatch.length === 1) return stateMatch[0];
  }

  return null;
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
  }).from(claims)
    .where(sql`(pro_id IS NULL OR pro_id = '') AND deleted_at IS NULL`)
    .orderBy(claims.lastName, claims.firstName);

  console.log(`Found ${missing.length} claims missing Pro ID\n`);

  // Deduplicate by name to minimize Redshift queries
  const nameMap = new Map<string, ClaimRow[]>();
  for (const c of missing) {
    const key = `${c.firstName.trim().toLowerCase()}|${c.lastName.trim().toLowerCase()}`;
    if (!nameMap.has(key)) nameMap.set(key, []);
    nameMap.get(key)!.push(c);
  }
  console.log(`${nameMap.size} unique names to search in Redshift\n`);

  let matched = 0;
  let ambiguous = 0;
  let noMatch = 0;
  const ambiguousList: { label: string; count: number; options: string[] }[] = [];
  const noMatchList: string[] = [];

  let searchCount = 0;
  for (const [nameKey, claimGroup] of nameMap) {
    const [fn, ln] = nameKey.split("|");
    searchCount++;
    if (searchCount % 25 === 0) {
      console.log(`  ... searched ${searchCount}/${nameMap.size} names`);
    }

    let results: RedshiftPro[];
    try {
      results = await searchRedshiftByName(fn, ln);
    } catch (err: any) {
      console.error(`  ERROR searching "${fn} ${ln}": ${err.message}`);
      noMatch += claimGroup.length;
      continue;
    }

    if (results.length === 0) {
      noMatch += claimGroup.length;
      claimGroup.forEach((c) =>
        noMatchList.push(`${c.matterNumber || "#" + c.id} (${c.lastName}, ${c.firstName})`)
      );
      continue;
    }

    for (const claim of claimGroup) {
      const label = `${claim.matterNumber || "#" + claim.id} (${claim.lastName}, ${claim.firstName} | DOI: ${claim.dateOfInjury})`;
      const best = pickBest(results, claim);

      if (best) {
        matched++;
        console.log(`  MATCH  ${label} → Pro ${best.proId} (${best.workerStatus}, ${best.locality || "?"}, ${best.state || "?"})`);
        if (EXECUTE) {
          await upsertPro(best);
          await db.update(claims).set({ proId: String(best.proId) }).where(eq(claims.id, claim.id));
        }
      } else {
        ambiguous++;
        ambiguousList.push({
          label,
          count: results.length,
          options: results.map((m) =>
            `Pro ${m.proId} (${m.workerStatus}, ${m.email}, ${m.locality || "?"} ${m.state || "?"})`
          ),
        });
      }
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Total missing:       ${missing.length}`);
  console.log(`Confident match:     ${matched}`);
  console.log(`Ambiguous (manual):  ${ambiguous}`);
  console.log(`No match:            ${noMatch}`);

  if (ambiguousList.length > 0) {
    console.log(`\n--- Ambiguous matches (${ambiguousList.length}) ---`);
    ambiguousList.forEach((m) => {
      console.log(`\n  ${m.label} → ${m.count} pros:`);
      m.options.forEach((o) => console.log(`    ${o}`));
    });
  }

  if (noMatchList.length > 0) {
    console.log(`\n--- No match (${noMatch}) ---`);
    noMatchList.forEach((n) => console.log(`  ${n}`));
  }

  if (!EXECUTE && matched > 0) {
    console.log(`\n(Dry run — no changes written. Run with --execute to apply.)`);
  }
}

run()
  .then(() => { pool.end(); process.exit(0); })
  .catch((err) => { console.error("Failed:", err); pool.end(); process.exit(1); });
