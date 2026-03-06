import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { Claim } from "@shared/schema";

interface ComplianceTabProps {
  claim: Claim;
  updateMutation: { isPending: boolean; mutate: (data: Record<string, any>) => void };
}

const ALL_CHECKLIST_ITEMS = [
  { field: "paidFullShift", label: "Paid Full Shift", show: () => true },
  { field: "fnolFiled", label: "FNOL Filed", show: () => true },
  { field: "froiFiled", label: "FROI Filed", show: () => true },
  { field: "wageStatementSent", label: "Wage Statement Sent", show: () => true },
  { field: "noShowCleared", label: "No-Show Cleared", show: () => true },
  { field: "lateCancellationCleared", label: "Late Cancellation Cleared", show: () => true },
  { field: "shiftsExcused", label: "Shifts Excused", show: () => true },
  { field: "payIssuedViaIncentiveAdp", label: "Pay Issued via Incentive/ADP", show: () => true },
  { field: "medicalPanelSent", label: "Medical Panel Sent (W2)", show: (c: Claim) => c.workerType === "W2" },
  { field: "mpnDwc7Sent", label: "MPN/DWC-7 Sent (CA W2)", show: (c: Claim) => c.workerType === "W2" && c.stateOfInjury === "CA" },
  { field: "billOfRightsSent", label: "Bill of Rights Sent (GA W2)", show: (c: Claim) => c.workerType === "W2" && c.stateOfInjury === "GA" },
  { field: "earningsStatementSent", label: "Earnings Statement Sent (1099)", show: (c: Claim) => c.workerType === "1099" },
  { field: "gaWc1FormSent", label: "GA WC-1 Form Sent", show: (c: Claim) => c.stateOfInjury === "GA" },
] as const;

export function ComplianceTab({ claim, updateMutation }: ComplianceTabProps) {
  const visibleItems = useMemo(
    () => ALL_CHECKLIST_ITEMS.filter((item) => item.show(claim)),
    [claim.workerType, claim.stateOfInjury],
  );

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Compliance Checklist
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {visibleItems.map((item) => (
            <div key={item.field} className="flex items-center gap-2 py-1">
              <Checkbox
                checked={(claim as any)[item.field] || false}
                onCheckedChange={(checked) => {
                  updateMutation.mutate({ [item.field]: !!checked });
                }}
                disabled={updateMutation.isPending}
                data-testid={`checkbox-${item.field}`}
              />
              <span className="text-xs">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
