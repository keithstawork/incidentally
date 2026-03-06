export const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function formatDate(
  date: string | null | undefined,
  yearFormat: "numeric" | "2-digit" = "numeric",
): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: yearFormat,
  });
}

/**
 * Format a string or number as full USD currency (e.g. "$1,234").
 * Accepts the string values stored in the claims table.
 */
export function formatCurrency(val: string | number | null | undefined): string {
  if (val == null) return "$0";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (!num || isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format a number as compact USD currency (e.g. "$1.2M", "$45K").
 * Used in dashboards and summaries.
 */
export function formatCurrencyCompact(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a number in compact form without currency (e.g. "1.2M", "45K").
 */
export function formatNumberCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[parseInt(m) - 1]} '${year.slice(2)}`;
}

const FIELD_LABELS: Record<string, string> = {
  firstName: "First Name", lastName: "Last Name", proId: "Pro ID",
  dateOfInjury: "Date of Injury", dateSubmitted: "Date Submitted",
  dateEmployerNotified: "Employer Notified", dateClosed: "Date Closed",
  workerType: "Shift Type", claimType: "Claim Type", claimStatus: "Status",
  injuryType: "Injury Type", stateOfInjury: "State", shiftType: "Shift Position",
  partnerName: "Partner", partnerState: "Partner State",
  shiftLocation: "Shift Location", insuredName: "Insured",
  carrier: "Carrier", policyYear: "Policy Year", stage: "Stage",
  litigated: "Litigated", tnsSpecialist: "T&S Specialist",
};

export function formatFieldName(field: string): string {
  return FIELD_LABELS[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}
