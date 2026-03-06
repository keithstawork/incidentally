import { db, pool } from "../../db";
import { pros } from "@shared/schema";
import { sql } from "drizzle-orm";

export const EXECUTE = process.argv.includes("--execute");

export function sanitize(s: string): string {
  return s.replace(/'/g, "''").trim();
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

export function nameSimilarity(a: string, b: string): number {
  const an = normalize(a);
  const bn = normalize(b);
  if (an === bn) return 1;
  if (an.includes(bn) || bn.includes(an)) return 0.8;
  let matches = 0;
  const shorter = an.length <= bn.length ? an : bn;
  const longer = an.length > bn.length ? an : bn;
  for (const ch of shorter) {
    if (longer.indexOf(ch) !== -1) matches++;
  }
  return matches / Math.max(an.length, bn.length);
}

export interface ProUpsertData {
  proId: number;
  name: string;
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
  w2Eligible: boolean | null;
  w2Employer: string | null;
  w2Status: string | null;
  backgroundCheckStatus: string | null;
  noshowCount: number | null;
  dateCreated: string | null;
  lastActive: string | null;
}

export async function upsertPro(data: ProUpsertData) {
  await db.insert(pros).values({
    proId: data.proId,
    name: data.name,
    givenName: data.givenName,
    familyName: data.familyName,
    email: data.email,
    phone: data.phone,
    address: data.address,
    locality: data.locality,
    state: data.state,
    stateCode: data.stateCode,
    zipcode: data.zipcode,
    workerStatus: data.workerStatus,
    workerLevel: data.workerLevel,
    w2Eligible: data.w2Eligible,
    w2Employer: data.w2Employer,
    w2Status: data.w2Status,
    backgroundCheckStatus: data.backgroundCheckStatus,
    noshowCount: data.noshowCount,
    dateCreated: data.dateCreated ? new Date(data.dateCreated) : null,
    lastActive: data.lastActive ? new Date(data.lastActive) : null,
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

/**
 * Standard teardown for scripts: close the DB pool and exit.
 * Usage: run().then(() => teardown(0)).catch((err) => { console.error("Failed:", err); teardown(1); });
 */
export function teardown(code: number = 0): void {
  pool.end();
  process.exit(code);
}
