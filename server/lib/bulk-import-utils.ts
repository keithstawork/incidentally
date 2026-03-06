export function parseDate(val: string): string | null {
  if (!val) return null;
  val = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const mdyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdyMatch) {
    let year = mdyMatch[3];
    if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year;
    return `${year}-${mdyMatch[1].padStart(2, "0")}-${mdyMatch[2].padStart(2, "0")}`;
  }
  return val;
}

export const WORKER_TYPE_MAP: Record<string, string> = {
  w2: "W2", "1099": "1099", cl: "CL",
  "workers compensation": "W2", "workers comp": "W2",
  "worker's comp": "W2", "worker's compensation": "W2", wc: "W2",
  "occupational accident": "1099", oa: "1099",
  "contingent liability": "CL", contingent: "CL",
};

export const CLAIM_TYPE_MAP: Record<string, string> = {
  "other than medical only": "Other Than Medical Only",
  "otherthanmedicalonly": "Other Than Medical Only",
  "accidental medical expense": "Accidental Medical Expense",
  "indemnity & medical": "Indemnity & Medical",
  "indemnity": "Indemnity",
};

export const VALID_WORKER_TYPES = ["W2", "1099", "CL"];
export const VALID_STATUSES = ["Open", "Closed", "Denied", "Incident Only", "Incident Report"];
export const VALID_STAGES = ["intake", "active_claim", "litigation", "settled", "closed"];
export const VALID_CLAIM_TYPES = [
  "Medical Only", "Other Than Medical Only", "Incident Only",
  "Incident Only W2", "Incident Only 1099", "Accidental Medical Expense",
  "Indemnity", "Indemnity & Medical", "Pending",
];

export const DATE_FIELDS = ["dateOfInjury", "dateSubmitted", "dateClosed", "dateEmployerNotified"];

export const BOOLEAN_FIELDS = [
  "litigated", "temporaryDisability", "permanentTotalDisability", "mmi",
  "medicalPanelSent", "mpnDwc7Sent", "billOfRightsSent", "paidFullShift",
  "payIssuedViaIncentiveAdp", "fnolFiled", "froiFiled", "wageStatementSent",
  "earningsStatementSent", "gaWc1FormSent", "noShowCleared",
  "lateCancellationCleared", "shiftsExcused", "ratingComplaint",
];

export const DECIMAL_FIELDS = [
  "totalPayments", "totalOutstanding", "incentiveAmount", "medicalTotal",
  "lossesPaid", "lossAdjustingExpenses", "settlementRecommendation",
  "settlementAuthority", "actualSettlementAmount",
];

export function parseProName(row: Record<string, any>): void {
  if (!row.proName || (row.firstName && row.lastName)) return;
  let fullName = String(row.proName).trim().replace(/\n/g, " ");
  fullName = fullName.replace(/\s*\(DOI\s+[\d/]+\)\s*$/i, "");
  fullName = fullName.replace(/[\s_]+\d{1,2}\/\d{1,2}\/\d{2,4}\s*$/, "").trim();
  const parts = fullName.split(/\s+/);
  row.firstName = parts[0];
  row.lastName = parts.length > 1 ? parts.slice(1).join(" ") : "";
  delete row.proName;
}

export function normalizeDates(row: Record<string, any>): void {
  for (const field of DATE_FIELDS) {
    if (row[field]) row[field] = parseDate(row[field]);
  }
}

export function normalizeWorkerType(row: Record<string, any>): void {
  if (!row.workerType) return;
  const wt = WORKER_TYPE_MAP[String(row.workerType).toLowerCase().trim()] || row.workerType;
  row.workerType = VALID_WORKER_TYPES.includes(wt) ? wt : "W2";
}

export function normalizeClaimStatus(row: Record<string, any>): void {
  if (row.claimStatus === "Not reported/Incident only 1099") row.claimStatus = "Incident Report";
  if (row.claimStatus && !VALID_STATUSES.includes(row.claimStatus)) row.claimStatus = "Open";
}

export function normalizeStage(row: Record<string, any>): void {
  if (row.stage && !VALID_STAGES.includes(row.stage)) row.stage = "intake";
}

export function normalizeClaimType(row: Record<string, any>): void {
  if (row.claimType) {
    row.claimType = CLAIM_TYPE_MAP[row.claimType.toLowerCase().trim()] || row.claimType;
  }
  if (row.claimType && !VALID_CLAIM_TYPES.includes(row.claimType)) row.claimType = "Pending";
}

export function parseBooleans(row: Record<string, any>): void {
  for (const field of BOOLEAN_FIELDS) {
    if (row[field] !== undefined) {
      const val = String(row[field]).toLowerCase().trim();
      row[field] = val === "true" || val === "yes" || val === "1" || val === "x";
    }
  }
}

export function parseDecimals(row: Record<string, any>): void {
  for (const field of DECIMAL_FIELDS) {
    if (row[field] !== undefined && row[field] !== null && row[field] !== "") {
      const cleaned = String(row[field]).replace(/[$,\s]/g, "");
      row[field] = isNaN(parseFloat(cleaned)) ? null : cleaned;
    } else {
      row[field] = null;
    }
  }
}

export function normalizeState(row: Record<string, any>): void {
  if (row.stateOfInjury) {
    row.stateOfInjury = String(row.stateOfInjury).trim().toUpperCase().substring(0, 2);
  }
}

/**
 * Apply all standard normalizations to an import/sync row.
 */
export function normalizeRow(row: Record<string, any>): void {
  parseProName(row);
  normalizeDates(row);
  normalizeWorkerType(row);
  normalizeClaimStatus(row);
  normalizeStage(row);
  normalizeClaimType(row);
  parseBooleans(row);
  parseDecimals(row);
  normalizeState(row);
}
