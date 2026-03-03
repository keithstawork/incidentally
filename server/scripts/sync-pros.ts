import { db } from "../db";
import { pros, claims } from "@shared/schema";
import { executeRedshiftQuery } from "../redshift";
import { sql, isNotNull } from "drizzle-orm";

const BATCH_SIZE = 500;

async function syncClaimPros() {
  console.log("Finding Pro IDs referenced in claims...");
  const claimRows = await db
    .selectDistinct({ proId: claims.proId })
    .from(claims)
    .where(isNotNull(claims.proId));

  const proIds = claimRows
    .map((r) => r.proId)
    .filter((id): id is string => !!id)
    .map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id));

  if (proIds.length === 0) {
    console.log("No Pro IDs found in claims. Nothing to sync.");
    return;
  }

  console.log(`Found ${proIds.length} unique Pro IDs in claims. Fetching from Redshift...`);

  for (let i = 0; i < proIds.length; i += BATCH_SIZE) {
    const batch = proIds.slice(i, i + BATCH_SIZE);
    const idList = batch.join(",");

    const query = `
      SELECT
        id AS pro_id, name, given_name, family_name, email,
        phonenum AS phone, address, locality, state, state_code,
        zipcode, worker_status, worker_level, w2_eligible, w2_employer,
        w2_status, background_check_status, noshow_count,
        date_created, last_active
      FROM iw_backend_db.backend_userprofile
      WHERE id IN (${idList})
    `;

    const { columns, rows } = await executeRedshiftQuery(query);
    const colIndex = Object.fromEntries(columns.map((c, idx) => [c, idx]));

    const values = rows.map((row) => ({
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
    }));

    if (values.length > 0) {
      await db
        .insert(pros)
        .values(values)
        .onConflictDoUpdate({
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

    console.log(`  Synced batch ${i / BATCH_SIZE + 1}: ${values.length} Pros`);
  }

  console.log("Sync complete.");
}

syncClaimPros()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
