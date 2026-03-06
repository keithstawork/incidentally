import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import type { Claim } from "@shared/schema";

const STRATEGY_FIELDS = [
  { label: "TL;DR / Executive Summary", field: "tldr" },
  { label: "Next Steps", field: "nextSteps" },
  { label: "Severity & Prognosis", field: "severityAndPrognosis" },
  { label: "Future Medical Expense", field: "futureMedicalExpense" },
  { label: "Pathway", field: "pathway" },
  { label: "Pathway Steps", field: "pathwaySteps" },
  { label: "Pathway - When to Use", field: "pathwayWhenToUse" },
] as const;

interface StrategyTabProps {
  claim: Claim;
  isEditing: boolean;
  getEditValue: (field: string) => any;
  setEditValue: (field: string, value: any) => void;
}

export function StrategyTab({ claim, isEditing, getEditValue, setEditValue }: StrategyTabProps) {
  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {STRATEGY_FIELDS.map(({ label, field }) => (
          <div key={field} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {label}
            </label>
            {isEditing ? (
              <Textarea
                className="text-xs min-h-[80px]"
                value={getEditValue(field) || ""}
                onChange={(e) => setEditValue(field, e.target.value)}
              />
            ) : (
              <div className="text-xs whitespace-pre-wrap rounded-md bg-muted/50 p-3 min-h-[40px]">
                {(claim as any)[field] || (
                  <span className="text-muted-foreground italic">Not set</span>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
