import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { STAGE_LABELS } from "@/lib/constants";
import { formatFieldName } from "@/lib/formatters";
import { formatDateTime } from "./helpers";
import type { ClaimStatusHistory } from "@shared/schema";

interface HistoryTabProps {
  history: ClaimStatusHistory[];
}

function parseChanges(raw: string | null | undefined): { field: string; from: any; to: any }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((c: any) => c && typeof c === "object" && "field" in c);
    }
  } catch { /* ignore malformed JSON */ }
  return [];
}

export function HistoryTab({ history }: HistoryTabProps) {
  const parsedHistory = useMemo(
    () => history.map((entry) => ({ entry, changes: parseChanges(entry.changes) })),
    [history],
  );

  return (
    <Card>
      <CardContent className="p-4">
        {parsedHistory.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No status changes recorded yet.
          </div>
        ) : (
          <div className="space-y-3">
            {parsedHistory.map(({ entry, changes }) => (
              <div
                key={entry.id}
                className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="mt-0.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {changes.length > 0 ? (
                    <div className="space-y-0.5">
                      {changes.map((c, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-medium">{formatFieldName(c.field)}</span>
                          <span className="text-muted-foreground">
                            {" "}{c.from || "—"} &rarr; {c.to || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {entry.fromStage !== entry.toStage && (
                        <span>
                          Stage: {STAGE_LABELS[entry.fromStage || ""] || entry.fromStage || "?"}{" "}
                          &rarr; {STAGE_LABELS[entry.toStage || ""] || entry.toStage || "?"}
                        </span>
                      )}
                      {entry.fromStatus !== entry.toStatus && (
                        <span>
                          Status: {entry.fromStatus || "?"} &rarr;{" "}
                          {entry.toStatus || "?"}
                        </span>
                      )}
                    </div>
                  )}
                  {entry.reason && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {entry.reason}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDateTime(entry.changedAt)} by {entry.changedBy || "system"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
