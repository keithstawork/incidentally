import { CheckCircle2, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { STEP_ICONS, STEP_LABELS } from "./helpers";

interface StepCardProps {
  stepNum: number;
  currentStep: number;
  label: string;
  summary: string;
  onClickHeader: () => void;
  children: React.ReactNode;
}

export function StepCard({
  stepNum,
  currentStep,
  label,
  summary,
  onClickHeader,
  children,
}: StepCardProps) {
  const isActive = currentStep === stepNum;
  const isCompleted = currentStep > stepNum;
  const isFuture = currentStep < stepNum;
  const Icon = STEP_ICONS[stepNum - 1];

  return (
    <Card className={isFuture ? "opacity-40 pointer-events-none" : ""}>
      <button
        type="button"
        onClick={onClickHeader}
        disabled={isFuture}
        className="w-full text-left"
      >
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 ${
              isCompleted
                ? "bg-primary text-primary-foreground"
                : isActive
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-muted text-muted-foreground"
            }`}>
              {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : stepNum}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {STEP_LABELS[stepNum - 1]}
                </h3>
              </div>
              {isCompleted && summary && (
                <p className="text-sm font-medium truncate mt-0.5">{summary}</p>
              )}
              {isActive && label && (
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              )}
            </div>
            {isCompleted && (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
          </div>
        </CardHeader>
      </button>
      {(isActive || isCompleted) && (
        <CardContent className="p-4 pt-2">
          {children}
        </CardContent>
      )}
    </Card>
  );
}
