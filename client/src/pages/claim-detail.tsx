import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  CheckCircle2,
  Scale,
  FileText,
  Clock,
  ExternalLink,
  Plus,
  Check,
  History,
  ClipboardList,
  Briefcase,
  MessageSquare,
  Trash2,
  GitMerge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Claim, ClaimNote, ClaimStatusHistory, Pro } from "@shared/schema";

const STAGES = ["intake", "active_claim", "litigation", "settled", "closed"] as const;
const STATUSES = ["Closed", "Denied", "Incident Only", "Incident Report", "Open"] as const;
const INJURY_TYPES = [
  "Burn", "Chemical Exposure", "Contusion", "Cut/Laceration",
  "Fall/Slip/Trip", "Falling Object", "Motor Vehicle Accident",
  "Strain: Lifting", "Strain: Repetitive movement", "Other",
];
const STAGE_LABELS: Record<string, string> = {
  intake: "Intake",
  active_claim: "Active Claim",
  litigation: "Litigation",
  settled: "Settled",
  closed: "Closed",
};
const NOTE_TYPE_LABELS: Record<string, string> = {
  action_item_adjuster: "Action Item - Adjuster",
  action_item_aws: "Action Item - AWS",
  action_item_legal: "Action Item - Legal",
  email_thread: "Email Thread",
  general_note: "General Note",
  status_change: "Status Change",
  update: "Update",
};

function formatFieldName(field: string): string {
  const labels: Record<string, string> = {
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
  return labels[field] || field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()).trim();
}

function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "-";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCurrency(val: string | null | undefined): string {
  if (!val || val === "0") return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(parseFloat(val));
}

function FieldRow({
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

function useProData(proId: string | null | undefined) {
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

function ProStatusBadge({ status }: { status: string | null | undefined }) {
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

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteType, setNewNoteType] = useState("general_note");
  const [newNoteAuthor, setNewNoteAuthor] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(0);
  const [deleteReason, setDeleteReason] = useState("");
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeOtherId, setMergeOtherId] = useState("");
  const [mergeOtherClaim, setMergeOtherClaim] = useState<Claim | null>(null);
  const [mergeResolved, setMergeResolved] = useState<Record<string, "primary" | "secondary">>({});
  const [mergeLoading, setMergeLoading] = useState(false);

  const { data: claim, isLoading } = useQuery<Claim>({
    queryKey: ["/api/claims", id],
  });

  const { data: notes = [] } = useQuery<ClaimNote[]>({
    queryKey: ["/api/claims", id, "notes"],
  });

  const { data: history = [] } = useQuery<ClaimStatusHistory[]>({
    queryKey: ["/api/claims", id, "history"],
  });

  const { data: pro } = useProData(claim?.proId);

  const { data: applicablePolicy } = useQuery<{
    policy: any | null;
    coverageType: string;
    coverageNote: string;
  }>({
    queryKey: ["/api/policies/applicable", claim?.workerType, claim?.dateOfInjury, claim?.litigated],
    queryFn: async () => {
      const params = new URLSearchParams({
        workerType: claim!.workerType,
        dateOfInjury: claim!.dateOfInjury,
        litigated: String(claim!.litigated ?? false),
      });
      const res = await fetch(`/api/policies/applicable?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!claim?.workerType && !!claim?.dateOfInjury,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/claims/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id, "history"] });
      toast({ title: "Claim updated" });
      setIsEditing(false);
      setEditFields({});
    },
    onError: () => toast({ title: "Error updating claim", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("DELETE", `/api/claims/${id}`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", "list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({ title: "Claim deleted" });
      navigate("/claims");
    },
    onError: () => toast({ title: "Error deleting claim", variant: "destructive" }),
  });

  const mergeMutation = useMutation({
    mutationFn: async ({ primaryId, secondaryId, resolvedFields }: { primaryId: number; secondaryId: number; resolvedFields: Record<string, any> }) => {
      const res = await apiRequest("POST", "/api/claims/merge", { primaryId, secondaryId, resolvedFields });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id, "history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", "list"] });
      toast({ title: "Claims merged successfully" });
      setMergeDialogOpen(false);
      setMergeOtherClaim(null);
      setMergeOtherId("");
      setMergeResolved({});
    },
    onError: () => toast({ title: "Error merging claims", variant: "destructive" }),
  });

  const MERGE_FIELDS: { key: string; label: string }[] = [
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

  const addNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/claims/${id}/notes`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id, "notes"] });
      setNewNoteContent("");
      toast({ title: "Note added" });
    },
    onError: () => toast({ title: "Error adding note", variant: "destructive" }),
  });

  const toggleNoteMutation = useMutation({
    mutationFn: async ({ noteId, completed }: { noteId: number; completed: boolean }) => {
      const res = await apiRequest("PATCH", `/api/notes/${noteId}`, { completed });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id, "notes"] });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full rounded-md" />
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20">
        <AlertTriangle className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Claim not found</p>
        <Button size="sm" variant="outline" asChild className="mt-3">
          <Link href="/claims">Back to Incidents</Link>
        </Button>
      </div>
    );
  }

  const getEditValue = (field: string) =>
    editFields[field] !== undefined ? editFields[field] : (claim as any)[field];

  const setEditValue = (field: string, value: any) =>
    setEditFields((prev) => ({ ...prev, [field]: value }));

  const totalIncurred =
    parseFloat(claim.totalPayments || "0") +
    parseFloat(claim.totalOutstanding || "0");
  const settlementSavings =
    claim.settlementAuthority && claim.actualSettlementAmount
      ? parseFloat(claim.settlementAuthority) -
        parseFloat(claim.actualSettlementAmount)
      : null;
  const daysSinceInjury = Math.floor(
    (Date.now() - new Date(claim.dateOfInjury).getTime()) / (1000 * 60 * 60 * 24)
  );

  const handleSave = () => {
    if (Object.keys(editFields).length === 0) {
      setIsEditing(false);
      return;
    }
    updateMutation.mutate(editFields);
  };

  const handleAddNote = () => {
    if (!newNoteContent.trim() || !newNoteAuthor.trim()) return;
    addNoteMutation.mutate({
      noteType: newNoteType,
      content: newNoteContent,
      author: newNoteAuthor,
    });
  };

  const handleStageTransition = (newStage: string) => {
    updateMutation.mutate({ stage: newStage });
  };

  const showW2Fields = claim.workerType === "W2";
  const show1099Fields = claim.workerType === "1099";
  const showGAFields = claim.stateOfInjury === "GA";
  const showCAFields = claim.stateOfInjury === "CA";
  const showLitigationFields = claim.litigated || claim.stage === "litigation";

  return (
    <div className="flex flex-col h-full">
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
                claim.claimStatus === "Open" ? "bg-[#C4A27F]/15 text-[#76614C] border-[#C4A27F]/30" :
                claim.claimStatus === "Closed" ? "bg-[#3B5747]/15 text-[#23342B] border-[#3B5747]/30" :
                claim.claimStatus === "Denied" ? "bg-[#EC5A53]/15 text-[#8E3632] border-[#EC5A53]/30" :
                "bg-[#576270]/10 text-[#576270] border-[#576270]/20"
              }`}>
                {claim.claimStatus}
              </span>
              <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                claim.stage === "intake" ? "bg-[#294EB2]/15 text-[#192F6B] border-[#294EB2]/30" :
                claim.stage === "litigation" ? "bg-[#EC5A53]/15 text-[#8E3632] border-[#EC5A53]/30" :
                claim.stage === "active_claim" ? "bg-[#3B5747]/15 text-[#23342B] border-[#3B5747]/30" :
                claim.stage === "settled" ? "bg-[#C4A27F]/15 text-[#76614C] border-[#C4A27F]/30" :
                "bg-[#576270]/10 text-[#576270] border-[#576270]/20"
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
                {MERGE_FIELDS.filter(({ key }) => {
                  const pVal = String((claim as any)[key] ?? "");
                  const sVal = String((mergeOtherClaim as any)[key] ?? "");
                  return pVal !== sVal;
                }).map(({ key, label }) => {
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
                {MERGE_FIELDS.filter(({ key }) => String((claim as any)[key] ?? "") !== String((mergeOtherClaim as any)[key] ?? "")).length === 0 && (
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

      <div className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="h-8">
            <TabsTrigger value="overview" className="text-xs gap-1.5" data-testid="tab-overview">
              <Briefcase className="h-3 w-3" /> Overview
            </TabsTrigger>
            <TabsTrigger value="strategy" className="text-xs gap-1.5" data-testid="tab-strategy">
              <FileText className="h-3 w-3" /> Case Strategy
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs gap-1.5" data-testid="tab-notes">
              <MessageSquare className="h-3 w-3" /> Notes ({notes.length})
            </TabsTrigger>
            <TabsTrigger value="compliance" className="text-xs gap-1.5" data-testid="tab-compliance">
              <ClipboardList className="h-3 w-3" /> Compliance
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5" data-testid="tab-history">
              <History className="h-3 w-3" /> History ({history.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Pro Details
                    </h3>
                    <ProStatusBadge status={pro?.workerStatus} />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-0.5">
                  <FieldRow label="First Name">
                    {isEditing ? (
                      <Input className="h-7 text-xs" value={getEditValue("firstName")} onChange={(e) => setEditValue("firstName", e.target.value)} />
                    ) : claim.firstName}
                  </FieldRow>
                  <FieldRow label="Last Name">
                    {isEditing ? (
                      <Input className="h-7 text-xs" value={getEditValue("lastName")} onChange={(e) => setEditValue("lastName", e.target.value)} />
                    ) : claim.lastName}
                  </FieldRow>
                  <FieldRow label="Pro ID">
                    {claim.proId ? (
                      <a href={`https://admin.instawork.com/internal/falcon/${claim.proId}/`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                        <ExternalLink className="h-3 w-3" /> {claim.proId}
                      </a>
                    ) : "-"}
                  </FieldRow>
                  <FieldRow label="Email">{pro?.email || "-"}</FieldRow>
                  <FieldRow label="Phone">{pro?.phone || "-"}</FieldRow>
                  <FieldRow label="Address">{pro?.address || "-"}</FieldRow>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Shift Details
                  </h3>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-0.5">
                  <FieldRow label="Partner">{claim.partnerName || "-"}</FieldRow>
                  <FieldRow label="Partner Address">{claim.shiftLocation || "-"}</FieldRow>
                  <FieldRow label="Shift ID">
                    {claim.shiftLink ? (() => {
                      const m = claim.shiftLink!.match(/\/shift\/([^/]+)/);
                      const shiftId = m ? m[1] : null;
                      return (
                        <a href={claim.shiftLink!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                          <ExternalLink className="h-3 w-3" /> {shiftId || "View shift"}
                        </a>
                      );
                    })() : "-"}
                  </FieldRow>
                  <FieldRow label="Shift Type">{claim.workerType || "-"}</FieldRow>
                  <FieldRow label="Position">{claim.shiftType || "-"}</FieldRow>
                  <FieldRow label="Pay Rate">{claim.payRate ? `$${parseFloat(claim.payRate).toFixed(2)}/hr` : "-"}</FieldRow>
                  <FieldRow label="Shift Length">{claim.shiftLengthHours ? `${parseFloat(claim.shiftLengthHours).toFixed(1)} hrs` : "-"}</FieldRow>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Insurance Details
                  </h3>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-0.5">
                  {applicablePolicy ? (
                    <>
                      <FieldRow label="Claim #">{claim.tpaClaimId || <span className="text-muted-foreground">Not yet assigned</span>}</FieldRow>
                      <FieldRow label="Coverage Type">
                        <span className="font-medium">{applicablePolicy.coverageType}</span>
                      </FieldRow>
                      {applicablePolicy.policy ? (
                        <>
                          <FieldRow label="Carrier">{applicablePolicy.policy.carrierName}</FieldRow>
                          {applicablePolicy.policy.policyNumber && (
                            <FieldRow label="Policy #">{applicablePolicy.policy.policyNumber}</FieldRow>
                          )}
                          <FieldRow label="Policy Period">
                            {applicablePolicy.policy.policyYearStart && applicablePolicy.policy.policyYearEnd
                              ? `${new Date(applicablePolicy.policy.policyYearStart).toLocaleDateString("en-US", { month: "short", year: "numeric" })} – ${new Date(applicablePolicy.policy.policyYearEnd).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                              : "-"}
                          </FieldRow>
                          <FieldRow label="Insured Party">{applicablePolicy.policy.insuredParty || "-"}</FieldRow>
                          {applicablePolicy.policy.notes && (
                            <FieldRow label="Coverage Details">
                              <span className="text-muted-foreground italic">{applicablePolicy.policy.notes}</span>
                            </FieldRow>
                          )}
                        </>
                      ) : (
                        <FieldRow label="Policy">
                          <span className="text-[#C4A27F] text-[10px]">No matching policy found for this date of injury</span>
                        </FieldRow>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">Determining coverage...</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Incident Details
                  </h3>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-0.5">
                  <FieldRow label="Status">
                    {isEditing ? (
                      <Select value={getEditValue("claimStatus") || ""} onValueChange={(v) => setEditValue("claimStatus", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    ) : claim.claimStatus || "-"}
                  </FieldRow>
                  <FieldRow label="Injury Type">
                    {isEditing ? (
                      <Select value={getEditValue("injuryType") || ""} onValueChange={(v) => setEditValue("injuryType", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {INJURY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : claim.injuryType || "-"}
                  </FieldRow>
                  <FieldRow label="Claim Type">
                    {isEditing ? (
                      <Select value={getEditValue("claimType") || ""} onValueChange={(v) => setEditValue("claimType", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Incident Only", "Incident Only 1099", "Incident Only W2", "Medical Only", "Other Than Medical Only", "Pending"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : claim.claimType || "-"}
                  </FieldRow>
                  <FieldRow label="Litigated">{claim.litigated ? "Yes" : "No"}</FieldRow>
                  <Separator className="my-1.5" />
                  <FieldRow label="T&S Agent">{claim.tnsSpecialist || "-"}</FieldRow>
                  <FieldRow label="Adjuster">
                    {isEditing ? (
                      <Input className="h-7 text-xs" value={getEditValue("adjuster") || ""} onChange={(e) => setEditValue("adjuster", e.target.value)} />
                    ) : claim.adjuster || "-"}
                  </FieldRow>
                  {showLitigationFields && (
                    <>
                      <FieldRow label="Applicant Attorney">{claim.applicantAttorney || "-"}</FieldRow>
                      <FieldRow label="Defense Attorney">{claim.defenseAttorney || "-"}</FieldRow>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Financials
                  </h3>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-0.5">
                  <FieldRow label="Total Payments">{formatCurrency(claim.totalPayments)}</FieldRow>
                  <FieldRow label="Total Outstanding">{formatCurrency(claim.totalOutstanding)}</FieldRow>
                  <FieldRow label="Total Incurred">
                    <span className="font-semibold">{formatCurrency(totalIncurred.toString())}</span>
                  </FieldRow>
                  <FieldRow label="Medical Total">{formatCurrency(claim.medicalTotal)}</FieldRow>
                  <FieldRow label="Losses Paid">{formatCurrency(claim.lossesPaid)}</FieldRow>
                  <FieldRow label="Loss Adjusting Expenses">{formatCurrency(claim.lossAdjustingExpenses)}</FieldRow>
                  <FieldRow label="Incentive Amount">{formatCurrency(claim.incentiveAmount)}</FieldRow>
                  <FieldRow label="Temp Disability">{claim.temporaryDisability ? "Yes" : "No"}</FieldRow>
                  <FieldRow label="Perm Total Disability">{claim.permanentTotalDisability ? "Yes" : "No"}</FieldRow>
                  <FieldRow label="MMI">{claim.mmi ? "Yes" : "No"}</FieldRow>
                  <FieldRow label="Impairment Rating">{claim.impairmentRating || "-"}</FieldRow>
                  {showLitigationFields && (
                    <>
                      <Separator className="my-1.5" />
                      <FieldRow label="Settlement Rec.">{formatCurrency(claim.settlementRecommendation)}</FieldRow>
                      <FieldRow label="Settlement Authority">{formatCurrency(claim.settlementAuthority)}</FieldRow>
                      <FieldRow label="Actual Settlement">{formatCurrency(claim.actualSettlementAmount)}</FieldRow>
                      {settlementSavings !== null && (
                        <FieldRow label="Settlement Savings">
                          <span className={settlementSavings >= 0 ? "text-[#3B5747]" : "text-[#EC5A53]"}>
                            {formatCurrency(settlementSavings.toString())}
                          </span>
                        </FieldRow>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {(claim.intercomLink || claim.shiftLink || claim.irLink || claim.medicalDocsLink) && (
              <Card>
                <CardHeader className="p-4 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    External Links
                  </h3>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {claim.intercomLink && (
                      <a href={claim.intercomLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Intercom
                      </a>
                    )}
                    {claim.shiftLink && (
                      <a href={claim.shiftLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Shift
                      </a>
                    )}
                    {claim.irLink && (
                      <a href={claim.irLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Incident Report
                      </a>
                    )}
                    {claim.medicalDocsLink && (
                      <a href={claim.medicalDocsLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                        <ExternalLink className="h-3 w-3" /> Medical Docs
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="strategy" className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                {[
                  { label: "TL;DR / Executive Summary", field: "tldr" },
                  { label: "Next Steps", field: "nextSteps" },
                  { label: "Severity & Prognosis", field: "severityAndPrognosis" },
                  { label: "Future Medical Expense", field: "futureMedicalExpense" },
                  { label: "Pathway", field: "pathway" },
                  { label: "Pathway Steps", field: "pathwaySteps" },
                  { label: "Pathway - When to Use", field: "pathwayWhenToUse" },
                ].map(({ label, field }) => (
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
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Add Note
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <Select value={newNoteType} onValueChange={setNewNoteType}>
                    <SelectTrigger className="h-8 w-[200px] text-xs" data-testid="select-note-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NOTE_TYPE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Your name"
                    value={newNoteAuthor}
                    onChange={(e) => setNewNoteAuthor(e.target.value)}
                    className="h-8 w-[140px] text-xs"
                    data-testid="input-note-author"
                  />
                </div>
                <Textarea
                  placeholder="Write your note..."
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  className="text-xs min-h-[60px]"
                  data-testid="input-note-content"
                />
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!newNoteContent.trim() || !newNoteAuthor.trim() || addNoteMutation.isPending}
                  data-testid="button-add-note"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add Note
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {notes.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No notes yet. Add the first one above.
                </div>
              ) : (
                notes.map((note) => {
                  const isActionItem = note.noteType.startsWith("action_item");
                  return (
                    <Card key={note.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          {isActionItem && (
                            <Checkbox
                              checked={note.completed || false}
                              onCheckedChange={(checked) =>
                                toggleNoteMutation.mutate({
                                  noteId: note.id,
                                  completed: !!checked,
                                })
                              }
                              className="mt-0.5"
                              data-testid={`checkbox-note-${note.id}`}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted">
                                {NOTE_TYPE_LABELS[note.noteType]}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                by {note.author}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDateTime(note.createdAt)}
                              </span>
                              {note.targetDate && (
                                <span className="text-[10px] text-[#C4A27F]">
                                  Due: {formatDate(note.targetDate)}
                                </span>
                              )}
                              {isActionItem && note.completed && (
                                <CheckCircle2 className="h-3 w-3 text-[#3B5747]" />
                              )}
                            </div>
                            <p className={`text-xs whitespace-pre-wrap ${isActionItem && note.completed ? "line-through text-muted-foreground" : ""}`}>
                              {note.content}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="compliance">
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Compliance Checklist
                </h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { field: "paidFullShift", label: "Paid Full Shift", show: true },
                    { field: "fnolFiled", label: "FNOL Filed", show: true },
                    { field: "froiFiled", label: "FROI Filed", show: true },
                    { field: "wageStatementSent", label: "Wage Statement Sent", show: true },
                    { field: "noShowCleared", label: "No-Show Cleared", show: true },
                    { field: "lateCancellationCleared", label: "Late Cancellation Cleared", show: true },
                    { field: "shiftsExcused", label: "Shifts Excused", show: true },
                    { field: "payIssuedViaIncentiveAdp", label: "Pay Issued via Incentive/ADP", show: true },
                    { field: "medicalPanelSent", label: "Medical Panel Sent (W2)", show: showW2Fields },
                    { field: "mpnDwc7Sent", label: "MPN/DWC-7 Sent (CA W2)", show: showW2Fields && showCAFields },
                    { field: "billOfRightsSent", label: "Bill of Rights Sent (GA W2)", show: showW2Fields && showGAFields },
                    { field: "earningsStatementSent", label: "Earnings Statement Sent (1099)", show: show1099Fields },
                    { field: "gaWc1FormSent", label: "GA WC-1 Form Sent", show: showGAFields },
                  ]
                    .filter((item) => item.show)
                    .map((item) => (
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
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardContent className="p-4">
                {history.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No status changes recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((entry) => {
                      let changes: { field: string; from: any; to: any }[] = [];
                      try {
                        if (entry.changes) {
                          const parsed = JSON.parse(entry.changes);
                          if (Array.isArray(parsed)) {
                            changes = parsed.filter((c: any) => c && typeof c === "object" && "field" in c);
                          }
                        }
                      } catch { /* ignore */ }
                      return (
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
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
