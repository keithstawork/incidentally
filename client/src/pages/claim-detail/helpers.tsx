import { useQuery } from "@tanstack/react-query";
import type { Pro } from "@shared/schema";

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 items-start py-1.5">
      <span className="text-xs text-muted-foreground col-span-1">{label}</span>
      <div className="col-span-2 text-xs">{children}</div>
    </div>
  );
}

export function useProData(proId: string | null | undefined) {
  return useQuery<Pro>({
    queryKey: ["/api/pros", proId],
    queryFn: async () => {
      const res = await fetch(`/api/pros/${proId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Pro not found");
      return res.json();
    },
    enabled: !!proId && /^\d+$/.test(proId),
    retry: false,
  });
}

export function ProStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const s = status.toLowerCase();
  const color = s === "active"
    ? "bg-[#3B5747]/15 text-[#3B5747] dark:bg-[#3B5747]/25 dark:text-[#B1BCB5]"
    : s === "suspended"
      ? "bg-[#C4A27F]/15 text-[#76614C] dark:bg-[#C4A27F]/25 dark:text-[#E7DACC]"
      : "bg-[#EC5A53]/15 text-[#8E3632] dark:bg-[#EC5A53]/25 dark:text-[#F7A9A9]";
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full ${color}`}>
      {status}
    </span>
  );
}

export const MERGE_FIELDS: { key: string; label: string }[] = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "tpaClaimId", label: "Claim Number" },
  { key: "workerType", label: "Worker Type" },
  { key: "claimType", label: "Claim Type" },
  { key: "claimStatus", label: "Status" },
  { key: "stage", label: "Stage" },
  { key: "injuryType", label: "Injury Type" },
  { key: "stateOfInjury", label: "State of Injury" },
  { key: "shiftType", label: "Shift Type" },
  { key: "partnerName", label: "Partner" },
  { key: "partnerState", label: "Partner State" },
  { key: "shiftLocation", label: "Shift Location" },
  { key: "dateSubmitted", label: "Date Submitted" },
  { key: "adjuster", label: "Adjuster" },
  { key: "tnsSpecialist", label: "T&S Specialist" },
  { key: "litigated", label: "Litigated" },
  { key: "carrier", label: "Carrier" },
  { key: "policyNumber", label: "Policy #" },
  { key: "policyYear", label: "Policy Year" },
  { key: "insuredName", label: "Insured" },
  { key: "reportNumber", label: "Report Number" },
  { key: "notes", label: "Notes" },
  { key: "litigationNotes", label: "Litigation Notes" },
];
