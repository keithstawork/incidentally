import { db, pool } from "../db";
import { claims, claimNotes } from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { parse } from "csv-parse/sync";
import * as fs from "fs";

const CSV_PATH = "/Users/keith/Downloads/Open Claims - File Review [WiP] - Open Claims-2.csv";
const EXECUTE = process.argv.includes("--execute");

function parseDollar(val: string | undefined): string | null {
  if (!val) return null;
  const cleaned = val.replace(/[$,\s]/g, "");
  if (!cleaned || cleaned === "#N/A" || isNaN(Number(cleaned))) return null;
  return cleaned;
}

function parseDate(val: string | undefined): string | null {
  if (!val || val === "#N/A") return null;
  const trimmed = val.trim();
  // MM/DD/YYYY
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

function parseBool(val: string | undefined): boolean | null {
  if (!val) return null;
  const lower = val.trim().toLowerCase();
  if (lower === "yes" || lower === "true" || lower === "1") return true;
  if (lower === "no" || lower === "false" || lower === "0") return false;
  return null;
}

function nonEmpty(val: string | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "#N/A" || trimmed === "N/A") return null;
  return trimmed;
}

function parsePolicyYear(val: string | undefined): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "#N/A") return null;
  // Extract all 4-digit years from the string
  const years = trimmed.match(/\b(20\d{2})\b/g);
  if (!years || years.length === 0) return null;
  const unique = [...new Set(years)].sort();
  // "2024-2025" fits in varchar(10)
  return unique.join("-");
}

function isEmpty(val: any): boolean {
  return val === null || val === undefined || val === "" || val === "0" || val === "$0";
}

function isFinancialEmpty(val: any): boolean {
  if (val === null || val === undefined || val === "") return true;
  const num = parseFloat(String(val));
  return isNaN(num) || num === 0;
}

interface CsvRow {
  TPAClaimID: string;
  FirstName: string;
  LastName: string;
  IncidentDate: string;
  "Next Step": string;
  "TL;DR": string;
  "Date Employer Notified": string;
  ClaimType: string;
  ClaimStatus: string;
  "Date of Report": string;
  Litigated: string;
  InsuredName: string;
  Carrier: string;
  "Policy Year": string;
  "Policy Number": string;
  "Closed Date": string;
  Adjuster: string;
  "AA ": string;
  DA: string;
  "Total Payments": string;
  "Total Outstanding": string;
  MMI: string;
  "Impairment Rating": string;
  "Settlement Recommendation": string;
  "Settlement Authority": string;
  "Actual Settlement Amount": string;
  "Severity and Prognosis": string;
  "Future Medical Expense": string;
  Updates: string;
  "Action Items (Adjuster)": string;
  "Action Items (AWS)": string;
  "Action Items (Legal)": string;
  Pathway: string;
  Steps: string;
  "When to Use": string;
}

async function findMatch(row: CsvRow) {
  const tpaId = nonEmpty(row.TPAClaimID);

  if (tpaId) {
    const [match] = await db
      .select()
      .from(claims)
      .where(and(eq(claims.tpaClaimId, tpaId), isNull(claims.deletedAt)))
      .limit(1);
    if (match) return match;
  }

  const firstName = nonEmpty(row.FirstName);
  const lastName = nonEmpty(row.LastName);
  const doi = parseDate(row.IncidentDate);

  if (firstName && lastName && doi) {
    const [match] = await db
      .select()
      .from(claims)
      .where(
        and(
          sql`LOWER(${claims.firstName}) = LOWER(${firstName})`,
          sql`LOWER(${claims.lastName}) = LOWER(${lastName})`,
          eq(claims.dateOfInjury, doi),
          isNull(claims.deletedAt),
        )
      )
      .limit(1);
    if (match) return match;
  }

  return null;
}

async function run() {
  console.log(`Mode: ${EXECUTE ? "EXECUTE (will write to DB)" : "DRY RUN (read-only)"}`);
  console.log(`Reading CSV: ${CSV_PATH}\n`);

  const raw = fs.readFileSync(CSV_PATH, "utf8");
  const allRows: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    from_line: 2, // skip the "Duplicate Claimant" meta-row; csv-parse treats line 2 as headers
  });

  // Filter out junk rows (e.g., #N/A-only rows)
  const rows = allRows.filter((r) => {
    const tpa = r.TPAClaimID?.trim();
    const fn = r.FirstName?.trim();
    const ln = r.LastName?.trim();
    return (tpa && tpa !== "#N/A") || (fn && fn !== "#N/A" && ln && ln !== "#N/A");
  }) as unknown as CsvRow[];

  console.log(`Parsed ${allRows.length} raw rows, ${rows.length} valid data rows\n`);

  let matched = 0;
  let unmatched = 0;
  let fieldsUpdated = 0;
  let notesCreated = 0;
  const unmatchedRows: string[] = [];

  for (const row of rows) {
    const claim = await findMatch(row);

    if (!claim) {
      unmatched++;
      const label = `${row.FirstName} ${row.LastName} (TPA: ${row.TPAClaimID || "none"}, DOI: ${row.IncidentDate})`;
      unmatchedRows.push(label);
      continue;
    }

    matched++;
    const updates: Record<string, any> = {};

    // --- Claim fields (fill blanks only) ---
    const fieldMap: [string, keyof typeof claim, () => any][] = [
      ["ClaimType", "claimType", () => nonEmpty(row.ClaimType)],
      ["ClaimStatus", "claimStatus", () => nonEmpty(row.ClaimStatus)],
      ["Litigated", "litigated", () => parseBool(row.Litigated)],
      ["Adjuster", "adjuster", () => nonEmpty(row.Adjuster)],
      ["AA", "applicantAttorney", () => nonEmpty(row["AA "])],
      ["DA", "defenseAttorney", () => nonEmpty(row.DA)],
      ["Date Employer Notified", "dateEmployerNotified", () => parseDate(row["Date Employer Notified"])],
      ["Closed Date", "dateClosed", () => parseDate(row["Closed Date"])],
      ["Date of Report", "dateSubmitted", () => parseDate(row["Date of Report"])],
      ["InsuredName", "insuredName", () => nonEmpty(row.InsuredName)],
      ["Carrier", "carrier", () => nonEmpty(row.Carrier)],
      ["Policy Year", "policyYear", () => parsePolicyYear(row["Policy Year"])],
      ["Policy Number", "policyNumber", () => nonEmpty(row["Policy Number"])],
    ];

    for (const [csvCol, dbField, parse] of fieldMap) {
      const currentVal = (claim as any)[dbField];
      if (isEmpty(currentVal)) {
        const newVal = parse();
        if (newVal !== null) {
          updates[dbField] = newVal;
        }
      }
    }

    // --- Financial fields (fill if null/zero) ---
    const financialMap: [string, keyof typeof claim, () => string | null][] = [
      ["Total Payments", "totalPayments", () => parseDollar(row["Total Payments"])],
      ["Total Outstanding", "totalOutstanding", () => parseDollar(row["Total Outstanding"])],
      ["Settlement Recommendation", "settlementRecommendation", () => parseDollar(row["Settlement Recommendation"])],
      ["Settlement Authority", "settlementAuthority", () => parseDollar(row["Settlement Authority"])],
      ["Actual Settlement Amount", "actualSettlementAmount", () => parseDollar(row["Actual Settlement Amount"])],
    ];

    for (const [csvCol, dbField, parse] of financialMap) {
      const currentVal = (claim as any)[dbField];
      if (isFinancialEmpty(currentVal)) {
        const newVal = parse();
        if (newVal !== null && parseFloat(newVal) !== 0) {
          updates[dbField] = newVal;
        }
      }
    }

    // Boolean financials
    const mmiVal = parseBool(row.MMI);
    if ((claim as any).mmi === null || (claim as any).mmi === undefined) {
      if (mmiVal !== null) updates.mmi = mmiVal;
    }

    const irVal = nonEmpty(row["Impairment Rating"]);
    if (isEmpty((claim as any).impairmentRating) && irVal) {
      updates.impairmentRating = irVal;
    }

    // --- Case strategy fields (fill blanks only) ---
    const strategyMap: [string, string][] = [
      ["TL;DR", "tldr"],
      ["Next Step", "nextSteps"],
      ["Severity and Prognosis", "severityAndPrognosis"],
      ["Future Medical Expense", "futureMedicalExpense"],
      ["Pathway", "pathway"],
      ["Steps", "pathwaySteps"],
      ["When to Use", "pathwayWhenToUse"],
    ];

    for (const [csvCol, dbField] of strategyMap) {
      const currentVal = (claim as any)[dbField];
      if (isEmpty(currentVal)) {
        const newVal = nonEmpty((row as any)[csvCol]);
        if (newVal) updates[dbField] = newVal;
      }
    }

    // Log field updates
    const updateCount = Object.keys(updates).length;
    if (updateCount > 0) {
      fieldsUpdated += updateCount;
      const matterNo = (claim as any).matterNumber || `#${claim.id}`;
      console.log(`  ${matterNo} (${claim.firstName} ${claim.lastName}): ${updateCount} fields → ${Object.keys(updates).join(", ")}`);

      if (EXECUTE) {
        await db.update(claims).set(updates).where(eq(claims.id, claim.id));
      }
    }

    // --- Notes (create if content is non-empty and no duplicate exists) ---
    const noteMap: [string, string][] = [
      ["Updates", "update"],
      ["Action Items (Adjuster)", "action_item_adjuster"],
      ["Action Items (AWS)", "action_item_aws"],
      ["Action Items (Legal)", "action_item_legal"],
    ];

    for (const [csvCol, noteType] of noteMap) {
      const content = nonEmpty((row as any)[csvCol]);
      if (!content) continue;

      // Check for existing note with same content to avoid duplicates
      const [existing] = await db
        .select({ id: claimNotes.id })
        .from(claimNotes)
        .where(
          and(
            eq(claimNotes.claimId, claim.id),
            eq(claimNotes.noteType, noteType as any),
            eq(claimNotes.author, "Spreadsheet Import"),
          )
        )
        .limit(1);

      if (existing) continue;

      notesCreated++;
      const matterNo = (claim as any).matterNumber || `#${claim.id}`;
      console.log(`  ${matterNo}: + note [${noteType}] (${content.length} chars)`);

      if (EXECUTE) {
        await db.insert(claimNotes).values({
          claimId: claim.id,
          noteType: noteType as any,
          content,
          author: "Spreadsheet Import",
        });
      }
    }
  }

  console.log("\n========== SUMMARY ==========");
  console.log(`Matched:         ${matched}`);
  console.log(`Unmatched:       ${unmatched}`);
  console.log(`Fields updated:  ${fieldsUpdated}`);
  console.log(`Notes created:   ${notesCreated}`);

  if (unmatchedRows.length > 0) {
    console.log(`\n--- Unmatched rows (${unmatchedRows.length}) ---`);
    unmatchedRows.forEach((r) => console.log(`  ${r}`));
  }

  if (!EXECUTE && (fieldsUpdated > 0 || notesCreated > 0)) {
    console.log("\n(Dry run — no changes written. Run with --execute to apply.)");
  }
}

run()
  .then(() => { pool.end(); process.exit(0); })
  .catch((err) => {
    console.error("Sync failed:", err);
    pool.end();
    process.exit(1);
  });
