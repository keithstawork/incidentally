/**
 * Backfill pay_rate and shift_length_hours on claims by looking up the shift
 * in Redshift (proId + dateOfInjury + partnerName) and pulling the applicant
 * rate and scheduled start/end times.
 */
import { db, pool } from "../db";
import { claims } from "@shared/schema";
import { executeRedshiftQuery } from "../redshift";
import { sql, eq } from "drizzle-orm";

const EXECUTE = process.argv.includes("--execute");

function sanitize(s: string): string {
  return s.replace(/'/g, "''").trim();
}

interface ShiftPayInfo {
  shiftId: number;
  applicantRate: number | null;
  hoursScheduled: number | null;
}

async function findShiftPayInfo(
  proId: number,
  doi: string,
  partnerName: string | null,
): Promise<ShiftPayInfo | null> {
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
    SELECT g.shift_id,
           g.booking_applicant_rate_usd,
           g.starts_at,
           g.ends_at
    FROM iw_backend_db.gigs_view g
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

    const rate = rows[0][ci.booking_applicant_rate_usd];
    const startsAt = rows[0][ci.starts_at] as string | null;
    const endsAt = rows[0][ci.ends_at] as string | null;

    let hoursScheduled: number | null = null;
    if (startsAt && endsAt) {
      const diffMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
      if (diffMs > 0) {
        hoursScheduled = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
      }
    }

    return {
      shiftId: rows[0][ci.shift_id] as number,
      applicantRate: rate != null ? parseFloat(String(rate)) : null,
      hoursScheduled,
    };
  } catch {
    return null;
  }
}

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

  console.log(
    `Found ${eligible.length} claims needing pay rate / shift length\n`,
  );

  let filled = 0;
  let noShift = 0;
  let noData = 0;
  let errorCount = 0;

  for (let i = 0; i < eligible.length; i++) {
    const c = eligible[i];
    const label = `${c.matterNumber || "#" + c.id} (${c.lastName}, ${c.firstName} | Pro ${c.proId})`;
    if ((i + 1) % 25 === 0) console.log(`  ... ${i + 1}/${eligible.length}`);

    const proId = parseInt(c.proId!, 10);
    if (isNaN(proId)) {
      errorCount++;
      continue;
    }

    const info = await findShiftPayInfo(proId, c.dateOfInjury, c.partnerName);
    if (!info) {
      noShift++;
      continue;
    }

    if (info.applicantRate == null && info.hoursScheduled == null) {
      noData++;
      continue;
    }

    filled++;
    const rateStr = info.applicantRate != null ? `$${info.applicantRate.toFixed(2)}/hr` : "n/a";
    const hoursStr = info.hoursScheduled != null ? `${info.hoursScheduled}h` : "n/a";
    console.log(`  FILL  ${label} → ${rateStr}, ${hoursStr}`);

    if (EXECUTE) {
      const updates: Record<string, any> = {};
      if (info.applicantRate != null && !c.payRate) {
        updates.payRate = String(info.applicantRate);
      }
      if (info.hoursScheduled != null && !c.shiftLengthHours) {
        updates.shiftLengthHours = String(info.hoursScheduled);
      }
      if (Object.keys(updates).length > 0) {
        await db.update(claims).set(updates).where(eq(claims.id, c.id));
      }
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Eligible claims:    ${eligible.length}`);
  console.log(`Filled:             ${filled}`);
  console.log(`No shift found:     ${noShift}`);
  console.log(`Shift but no data:  ${noData}`);
  console.log(`Errors:             ${errorCount}`);

  if (!EXECUTE && filled > 0) {
    console.log(
      `\n(Dry run — run with --execute to apply ${filled} updates.)`,
    );
  }
}

run()
  .then(() => {
    pool.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Failed:", err);
    pool.end();
    process.exit(1);
  });
