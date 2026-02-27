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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Claim, ClaimNote, ClaimStatusHistory } from "@shared/schema";

const STAGES = ["intake", "active_claim", "litigation", "settled", "closed"] as const;
const STATUSES = ["Open", "Closed", "Denied", "Incident Only", "Not reported/Incident only 1099"] as const;
const STAGE_LABELS: Record<string, string> = {
  intake: "Intake",
  active_claim: "Active Claim",
  litigation: "Litigation",
  settled: "Settled",
  closed: "Closed",
};
const NOTE_TYPE_LABELS: Record<string, string> = {
  update: "Update",
  action_item_adjuster: "Action Item - Adjuster",
  action_item_aws: "Action Item - AWS",
  action_item_legal: "Action Item - Legal",
  general_note: "General Note",
  email_thread: "Email Thread",
  status_change: "Status Change",
};

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

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editFields, setEditFields] = useState<Record<string, any>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteType, setNewNoteType] = useState("general_note");
  const [newNoteAuthor, setNewNoteAuthor] = useState("");

  const { data: claim, isLoading } = useQuery<Claim>({
    queryKey: ["/api/claims", id],
  });

  const { data: notes = [] } = useQuery<ClaimNote[]>({
    queryKey: ["/api/claims", id, "notes"],
  });

  const { data: history = [] } = useQuery<ClaimStatusHistory[]>({
    queryKey: ["/api/claims", id, "history"],
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
          <Link href="/claims">Back to Claims</Link>
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
                #{claim.id}
              </span>
              {claim.tpaClaimId && (
                <span className="text-xs text-muted-foreground font-mono">
                  TPA: {claim.tpaClaimId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                claim.claimStatus === "Open" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                claim.claimStatus === "Closed" ? "bg-green-100 text-green-800 border-green-200" :
                claim.claimStatus === "Denied" ? "bg-red-100 text-red-800 border-red-200" :
                "bg-gray-100 text-gray-600 border-gray-200"
              }`}>
                {claim.claimStatus}
              </span>
              <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
                claim.stage === "intake" ? "bg-blue-100 text-blue-700 border-blue-200" :
                claim.stage === "litigation" ? "bg-red-100 text-red-700 border-red-200" :
                claim.stage === "active_claim" ? "bg-purple-100 text-purple-700 border-purple-200" :
                claim.stage === "settled" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                "bg-gray-100 text-gray-600 border-gray-200"
              }`}>
                {STAGE_LABELS[claim.stage]}
              </span>
              {claim.litigated && (
                <span className="inline-flex items-center gap-1 text-[10px] text-red-600">
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
          </div>
        </div>
      </div>

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
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Identity & Basics
                  </h3>
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
                  <FieldRow label="Pro ID">{claim.proId || "-"}</FieldRow>
                  <FieldRow label="Date of Injury">{formatDate(claim.dateOfInjury)}</FieldRow>
                  <FieldRow label="Date Submitted">{formatDate(claim.dateSubmitted)}</FieldRow>
                  <FieldRow label="Employer Notified">{formatDate(claim.dateEmployerNotified)}</FieldRow>
                  <FieldRow label="Date Closed">{formatDate(claim.dateClosed)}</FieldRow>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Classification
                  </h3>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-0.5">
                  <FieldRow label="Worker Type">{claim.workerType}</FieldRow>
                  <FieldRow label="Claim Type">
                    {isEditing ? (
                      <Select value={getEditValue("claimType") || ""} onValueChange={(v) => setEditValue("claimType", v)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Medical Only", "Other Than Medical Only", "Incident Only", "Incident Only W2", "Incident Only 1099", "Pending"].map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : claim.claimType || "-"}
                  </FieldRow>
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
                  <FieldRow label="Injury Type">{claim.injuryType || "-"}</FieldRow>
                  <FieldRow label="State">{claim.stateOfInjury || "-"}</FieldRow>
                  <FieldRow label="Shift Type">{claim.shiftType || "-"}</FieldRow>
                  <FieldRow label="Litigated">{claim.litigated ? "Yes" : "No"}</FieldRow>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Parties
                  </h3>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-0.5">
                  <FieldRow label="Partner">{claim.partnerName}</FieldRow>
                  <FieldRow label="Insured">{claim.insuredName || "-"}</FieldRow>
                  <FieldRow label="Carrier">{claim.carrier || "-"}</FieldRow>
                  <FieldRow label="Policy Year">{claim.policyYear || "-"}</FieldRow>
                  <FieldRow label="Policy #">{claim.policyNumber || "-"}</FieldRow>
                  <FieldRow label="T&S Specialist">{claim.tnsSpecialist || "-"}</FieldRow>
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
                          <span className={settlementSavings >= 0 ? "text-green-600" : "text-red-600"}>
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
                                <span className="text-[10px] text-orange-600">
                                  Due: {formatDate(note.targetDate)}
                                </span>
                              )}
                              {isActionItem && note.completed && (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
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
                    {history.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0"
                      >
                        <div className="mt-0.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
