/**
 * Backfill pay_rate and shift_length_hours on claims using a single bulk
 * Redshift query instead of one-per-claim. Runs in under a minute.
 */
import { db } from "../db";
import { claims } from "@shared/schema";
import { executeRedshiftQuery } from "../redshift";
import { sql, eq } from "drizzle-orm";
import pLimit from "p-limit";
import { EXECUTE, sanitize, teardown } from "./lib/shared";

async function run() {
  console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY RUN"}\n`);

  const eligible = await db
    .select({
      id: claims.id,
      matterNumber: claims.matterNumber,
      proId: claims.proId,
      dateOfInjury: claims.dateOfInjury,
      partnerName: claims.partnerName,
      firstName: claims.firstName,
      lastName: claims.lastName,
      payRate: claims.payRate,
      shiftLengthHours: claims.shiftLengthHours,
    })
    .from(claims)
    .where(
      sql`
      pro_id IS NOT NULL AND pro_id != ''
      AND (pay_rate IS NULL OR shift_length_hours IS NULL)
      AND deleted_at IS NULL
    `,
    )
    .orderBy(claims.id);

  console.log(`Found ${eligible.length} claims needing pay rate / shift length\n`);

  const validClaims = eligible.filter((c) => {
    const proId = parseInt(c.proId!, 10);
    return !isNaN(proId) && proId > 0;
  });

  if (validClaims.length === 0) {
    console.log("No valid claims to process.");
    return;
  }

  // Build a single bulk query with all (worker_id, date) pairs
  // Redshift has a limit on query size, so batch into chunks of ~500
  const BATCH_SIZE = 500;
  const allResults = new Map<string, { rate: number | null; hours: number | null }>();

  for (let batch = 0; batch < validClaims.length; batch += BATCH_SIZE) {
    const chunk = validClaims.slice(batch, batch + BATCH_SIZE);
    const batchNum = Math.floor(batch / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(validClaims.length / BATCH_SIZE);
    console.log(`  Querying Redshift batch ${batchNum}/${totalBatches} (${chunk.length} claims)...`);

    // Build WHERE clause: (worker_id = X AND starts_at::date = 'YYYY-MM-DD') OR ...
    const conditions = chunk.map((c) => {
      const proId = parseInt(c.proId!, 10);
      const safeDate = sanitize(c.dateOfInjury);
      return `(g.worker_id = ${proId} AND g.starts_at::date = '${safeDate}')`;
    });

    const query = `
      SELECT g.worker_id,
             g.starts_at::date AS doi,
             g.booking_applicant_rate_usd,
             g.starts_at,
             g.ends_at,
             ROW_NUMBER() OVER (
               PARTITION BY g.worker_id, g.starts_at::date
               ORDER BY g.starts_at
             ) AS rn
      FROM iw_backend_db.gigs_view g
      WHERE g.is_cancelled = 0
        AND (${conditions.join("\n        OR ")})
    `;

    try {
      const { columns, rows } = await executeRedshiftQuery(query);
      const ci = Object.fromEntries(columns.map((c, i) => [c, i]));

      for (const row of rows) {
        if (row[ci.rn] !== 1 && row[ci.rn] !== "1") continue; // first shift per worker+date only

        const workerId = String(row[ci.worker_id]);
        const doi = String(row[ci.doi]);
        const key = `${workerId}|${doi}`;

        const rateVal = row[ci.booking_applicant_rate_usd];
        const startsAt = row[ci.starts_at] as string | null;
        const endsAt = row[ci.ends_at] as string | null;

        let hours: number | null = null;
        if (startsAt && endsAt) {
          const diffMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
          if (diffMs > 0) {
            hours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
          }
        }

        allResults.set(key, {
          rate: rateVal != null ? parseFloat(String(rateVal)) : null,
          hours,
        });
      }
    } catch (err) {
      console.error(`  Batch ${batchNum} failed:`, err);
    }
  }

  console.log(`\nRedshift returned data for ${allResults.size} worker+date pairs\n`);

  let filled = 0;
  let noShift = 0;
  let noData = 0;

  const dbLimit = pLimit(10);
  const tasks = validClaims.map((c) => dbLimit(async () => {
    const proId = parseInt(c.proId!, 10);
    const key = `${proId}|${c.dateOfInjury}`;
    const label = `${c.matterNumber || "#" + c.id} (${c.lastName}, ${c.firstName} | Pro ${c.proId})`;

    const info = allResults.get(key);
    if (!info) {
      noShift++;
      return;
    }

    if (info.rate == null && info.hours == null) {
      noData++;
      return;
    }

    filled++;
    const rateStr = info.rate != null ? `$${info.rate.toFixed(2)}/hr` : "n/a";
    const hoursStr = info.hours != null ? `${info.hours}h` : "n/a";
    console.log(`  FILL  ${label} → ${rateStr}, ${hoursStr}`);

    if (EXECUTE) {
      const updates: Record<string, any> = {};
      if (info.rate != null && !c.payRate) {
        updates.payRate = String(info.rate);
      }
      if (info.hours != null && !c.shiftLengthHours) {
        updates.shiftLengthHours = String(info.hours);
      }
      if (Object.keys(updates).length > 0) {
        await db.update(claims).set(updates).where(eq(claims.id, c.id));
      }
    }
  }));
  await Promise.all(tasks);

  const invalidCount = eligible.length - validClaims.length;

  console.log("\n========== SUMMARY ==========");
  console.log(`Eligible claims:    ${eligible.length}`);
  console.log(`Valid Pro IDs:      ${validClaims.length}`);
  console.log(`Filled:             ${filled}`);
  console.log(`No shift found:     ${noShift}`);
  console.log(`Shift but no data:  ${noData}`);
  console.log(`Invalid Pro IDs:    ${invalidCount}`);

  if (!EXECUTE && filled > 0) {
    console.log(
      `\n(Dry run — run with --execute to apply ${filled} updates.)`,
    );
  }
}

run()
  .then(() => teardown(0))
  .catch((err) => { console.error("Failed:", err); teardown(1); });
