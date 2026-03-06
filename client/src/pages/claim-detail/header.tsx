import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Save, Scale, Trash2, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { STATUS_BADGE_VARIANTS, STAGE_BADGE_VARIANTS, STAGE_LABELS } from "@/lib/constants";
import { MERGE_FIELDS } from "./helpers";
import type { Claim } from "@shared/schema";
import type { UseMutationResult } from "@tanstack/react-query";

interface HeaderProps {
  claim: Claim;
  daysSinceInjury: number;
  isEditing: boolean;
  setIsEditing: (v: boolean) => void;
  setEditFields: (v: Record<string, any>) => void;
  handleSave: () => void;
  handleStageTransition: (stage: string) => void;
  updateMutation: UseMutationResult<any, Error, Record<string, any>>;
  deleteMutation: UseMutationResult<any, Error, string>;
  mergeMutation: UseMutationResult<any, Error, { primaryId: number; secondaryId: number; resolvedFields: Record<string, any> }>;
}

export function Header({
  claim,
  daysSinceInjury,
  isEditing,
  setIsEditing,
  setEditFields,
  handleSave,
  handleStageTransition,
  updateMutation,
  deleteMutation,
  mergeMutation,
}: HeaderProps) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const [deleteReason, setDeleteReason] = useState("");
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeOtherId, setMergeOtherId] = useState("");
  const [mergeOtherClaim, setMergeOtherClaim] = useState<Claim | null>(null);
  const [mergeResolved, setMergeResolved] = useState<Record<string, "primary" | "secondary">>({});
  const [mergeLoading, setMergeLoading] = useState(false);

  const fetchMergeCandidate = async () => {
    if (!mergeOtherId.trim()) return;
    setMergeLoading(true);
    try {
      const res = await fetch(`/api/claims/${mergeOtherId.trim()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      const other = await res.json();
      setMergeOtherClaim(other);
      const defaults: Record<string, "primary" | "secondary"> = {};
      MERGE_FIELDS.forEach(({ key }) => {
        const pVal = (claim as any)?.[key];
        const sVal = (other as any)?.[key];
        if (String(pVal ?? "") !== String(sVal ?? "")) {
          defaults[key] = pVal ? "primary" : "secondary";
        }
      });
      setMergeResolved(defaults);
    } catch {
      toast({ title: "Claim not found", variant: "destructive" });
      setMergeOtherClaim(null);
    } finally {
      setMergeLoading(false);
    }
  };

  const executeMerge = () => {
    if (!claim || !mergeOtherClaim) return;
    const resolvedFields: Record<string, any> = {};
    MERGE_FIELDS.forEach(({ key }) => {
      const pVal = (claim as any)[key];
      const sVal = (mergeOtherClaim as any)[key];
      if (String(pVal ?? "") !== String(sVal ?? "")) {
        const choice = mergeResolved[key] || "primary";
        resolvedFields[key] = choice === "primary" ? pVal : sVal;
      }
    });
    if (claim.notes && mergeOtherClaim.notes && mergeResolved["notes"] !== "secondary") {
      resolvedFields.notes = `${claim.notes}\n\n--- Merged from incident ${(mergeOtherClaim as any).matterNumber || `#${mergeOtherClaim.id}`} ---\n${mergeOtherClaim.notes}`;
    }
    mergeMutation.mutate({ primaryId: claim.id, secondaryId: mergeOtherClaim.id, resolvedFields });
  };

  const diffFields = mergeOtherClaim
    ? MERGE_FIELDS.filter(({ key }) => {
        const pVal = String((claim as any)[key] ?? "");
        const sVal = String((mergeOtherClaim as any)[key] ?? "");
        return pVal !== sVal;
      })
    : [];

  return (
    <>
      <div className="border-b bg-background px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="ghost" size="icon" asChild data-testid="button-back-claims">
            <Link href="/claims">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold truncate" data-testid="text-claim-name">
                {claim.firstName} {claim.lastName}
              </h1>
              <span className="text-xs text-muted-foreground font-mono">
                {(claim as any).matterNumber || `#${claim.id}`}
              </span>
              {claim.tpaClaimId && (
                <span className="text-xs text-muted-foreground font-mono">
                  TPA: {claim.tpaClaimId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                (claim.claimStatus && STATUS_BADGE_VARIANTS[claim.claimStatus]) || "bg-[#576270]/10 text-[#576270] border-[#576270]/20"
              }`}>
                {claim.claimStatus}
              </span>
              <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                (claim.stage && STAGE_BADGE_VARIANTS[claim.stage]) || "bg-[#576270]/10 text-[#576270] border-[#576270]/20"
              }`}>
                {STAGE_LABELS[claim.stage]}
              </span>
              {claim.litigated && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[#EC5A53]">
                  <Scale className="h-3 w-3" /> Litigated
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {daysSinceInjury} days since injury
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {claim.stage === "intake" && (
              <Button
                size="sm"
                onClick={() => handleStageTransition("active_claim")}
                disabled={updateMutation.isPending}
                data-testid="button-escalate"
              >
                Escalate to Active Claim
              </Button>
            )}
            {claim.stage === "active_claim" && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleStageTransition("litigation")}
                disabled={updateMutation.isPending}
                data-testid="button-litigate"
              >
                <Scale className="mr-1.5 h-3.5 w-3.5" />
                Move to Litigation
              </Button>
            )}
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                data-testid="button-edit-claim"
              >
                Edit
              </Button>
            ) : (
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(false);
                    setEditFields({});
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  data-testid="button-save-claim"
                >
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setMergeDialogOpen(true); setMergeOtherClaim(null); setMergeOtherId(""); }}
              title="Merge with another claim"
            >
              <GitMerge className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => { setDeleteDialogOpen(true); setDeleteConfirmStep(0); setDeleteReason(""); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteConfirmStep === 0 ? "Delete this claim?" : "Confirm deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmStep === 0 ? (
                <>This will remove incident {(claim as any).matterNumber || `#${claim.id}`} ({claim.firstName} {claim.lastName}) from all views. The record will be preserved for audit purposes.</>
              ) : (
                <>Please provide a reason for deleting this claim. This will be recorded in the claim history.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteConfirmStep === 1 && (
            <div className="py-2">
              <Textarea
                placeholder="Reason for deletion (e.g., duplicate claim, entered in error...)"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="text-sm"
                rows={3}
                autoFocus
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteConfirmStep(0); setDeleteReason(""); }}>
              Cancel
            </AlertDialogCancel>
            {deleteConfirmStep === 0 ? (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={(e) => { e.preventDefault(); setDeleteConfirmStep(1); }}
              >
                Yes, delete this claim
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={!deleteReason.trim() || deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteReason.trim())}
              >
                {deleteMutation.isPending ? "Deleting..." : "Confirm deletion"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={mergeDialogOpen} onOpenChange={(open) => { setMergeDialogOpen(open); if (!open) { setMergeOtherClaim(null); setMergeOtherId(""); setMergeResolved({}); } }}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Merge Claims</AlertDialogTitle>
            <AlertDialogDescription>
              Merge another incident into this one ({(claim as any).matterNumber || `#${claim.id}`}). The other incident will be soft-deleted and its notes/history transferred here.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {!mergeOtherClaim ? (
            <div className="flex gap-2 py-2">
              <Input
                placeholder="Enter claim ID to merge..."
                value={mergeOtherId}
                onChange={(e) => setMergeOtherId(e.target.value)}
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && fetchMergeCandidate()}
              />
              <Button size="sm" onClick={fetchMergeCandidate} disabled={mergeLoading || !mergeOtherId.trim()}>
                {mergeLoading ? "Loading..." : "Find"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-[1fr,auto,1fr] gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                <span>This Claim ({(claim as any).matterNumber || `#${claim.id}`})</span>
                <span className="w-16 text-center">Keep</span>
                <span>Other ({(mergeOtherClaim as any).matterNumber || `#${mergeOtherClaim.id}`})</span>
              </div>
              <div className="space-y-0.5 max-h-[50vh] overflow-y-auto">
                {diffFields.map(({ key, label }) => {
                  const pVal = (claim as any)[key];
                  const sVal = (mergeOtherClaim as any)[key];
                  const choice = mergeResolved[key] || "primary";
                  const fmtVal = (v: any) => v === true ? "Yes" : v === false ? "No" : v || <span className="text-muted-foreground italic">empty</span>;
                  return (
                    <div key={key} className="grid grid-cols-[1fr,auto,1fr] gap-1 items-center rounded px-1 py-1 hover:bg-muted/30">
                      <button
                        className={`text-left text-xs p-1 rounded border ${choice === "primary" ? "border-primary bg-primary/5 font-medium" : "border-transparent"}`}
                        onClick={() => setMergeResolved((p) => ({ ...p, [key]: "primary" }))}
                      >
                        <span className="text-[10px] text-muted-foreground block">{label}</span>
                        {fmtVal(pVal)}
                      </button>
                      <div className="w-16 flex justify-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${choice === "primary" ? "bg-primary/10 text-primary" : "bg-[#C4A27F]/15 text-[#76614C]"}`}>
                          {choice === "primary" ? "←" : "→"}
                        </span>
                      </div>
                      <button
                        className={`text-left text-xs p-1 rounded border ${choice === "secondary" ? "border-[#C4A27F] bg-[#C4A27F]/10 font-medium" : "border-transparent"}`}
                        onClick={() => setMergeResolved((p) => ({ ...p, [key]: "secondary" }))}
                      >
                        <span className="text-[10px] text-muted-foreground block">{label}</span>
                        {fmtVal(sVal)}
                      </button>
                    </div>
                  );
                })}
                {diffFields.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No differing fields — claims are identical.</p>
                )}
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {mergeOtherClaim && (
              <AlertDialogAction
                onClick={executeMerge}
                disabled={mergeMutation.isPending}
              >
                {mergeMutation.isPending ? "Merging..." : `Merge ${(mergeOtherClaim as any).matterNumber || `#${mergeOtherClaim.id}`} into ${(claim as any).matterNumber || `#${claim.id}`}`}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
