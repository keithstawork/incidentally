import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import {
  AlertTriangle,
  Briefcase,
  FileText,
  MessageSquare,
  ClipboardList,
  History,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Header } from "./header";
import { OverviewTab } from "./overview-tab";
import { StrategyTab } from "./strategy-tab";
import { NotesTab } from "./notes-tab";
import { ComplianceTab } from "./compliance-tab";
import { DocumentsTab } from "./documents-tab";
import { HistoryTab } from "./history-tab";
import type { Claim, ClaimNote, ClaimStatusHistory, Pro } from "@shared/schema";

interface ClaimDetailResponse {
  claim: Claim;
  notes: ClaimNote[];
  history: ClaimStatusHistory[];
  pro: Pro | null;
  applicablePolicy: { policy: any | null; coverageType: string; coverageNote: string } | null;
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

  const { data: detail, isLoading } = useQuery<ClaimDetailResponse>({
    queryKey: ["/api/claims", id, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${id}/detail`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return res.json();
    },
  });

  const claim = detail?.claim;
  const notes = detail?.notes ?? [];
  const history = detail?.history ?? [];
  const pro = detail?.pro ?? undefined;
  const applicablePolicy = detail?.applicablePolicy ?? undefined;

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/claims/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id, "detail"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["/api/claims", "list"] });
      toast({ title: "Claims merged successfully" });
    },
    onError: () => toast({ title: "Error merging claims", variant: "destructive" }),
  });

  const addNoteMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/claims/${id}/notes`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id, "detail"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/claims", id, "detail"] });
    },
  });

  const getEditValue = useCallback(
    (field: string) => editFields[field] !== undefined ? editFields[field] : (claim as any)?.[field],
    [editFields, claim],
  );

  const setEditValue = useCallback(
    (field: string, value: any) => setEditFields((prev) => ({ ...prev, [field]: value })),
    [],
  );

  const totalIncurred = useMemo(
    () => parseFloat(claim?.totalPayments || "0") + parseFloat(claim?.totalOutstanding || "0"),
    [claim?.totalPayments, claim?.totalOutstanding],
  );
  const settlementSavings = useMemo(
    () => claim?.settlementAuthority && claim?.actualSettlementAmount
      ? parseFloat(claim.settlementAuthority) - parseFloat(claim.actualSettlementAmount)
      : null,
    [claim?.settlementAuthority, claim?.actualSettlementAmount],
  );
  const daysSinceInjury = useMemo(
    () => claim ? Math.floor((Date.now() - new Date(claim.dateOfInjury).getTime()) / (1000 * 60 * 60 * 24)) : 0,
    [claim?.dateOfInjury],
  );

  const showLitigationFields = useMemo(
    () => !!(claim?.litigated || claim?.stage === "litigation"),
    [claim?.litigated, claim?.stage],
  );

  const handleSave = useCallback(() => {
    if (Object.keys(editFields).length === 0) {
      setIsEditing(false);
      return;
    }
    updateMutation.mutate(editFields);
  }, [editFields, updateMutation]);

  const handleAddNote = useCallback(() => {
    if (!newNoteContent.trim() || !newNoteAuthor.trim()) return;
    addNoteMutation.mutate({
      noteType: newNoteType,
      content: newNoteContent,
      author: newNoteAuthor,
    });
  }, [newNoteContent, newNoteAuthor, newNoteType, addNoteMutation]);

  const handleStageTransition = useCallback(
    (newStage: string) => { updateMutation.mutate({ stage: newStage }); },
    [updateMutation],
  );

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

  return (
    <div className="flex flex-col h-full">
      <Header
        claim={claim}
        daysSinceInjury={daysSinceInjury}
        isEditing={isEditing}
        setIsEditing={setIsEditing}
        setEditFields={setEditFields}
        handleSave={handleSave}
        handleStageTransition={handleStageTransition}
        updateMutation={updateMutation}
        deleteMutation={deleteMutation}
        mergeMutation={mergeMutation}
      />

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
            <TabsTrigger value="documents" className="text-xs gap-1.5" data-testid="tab-documents">
              <Paperclip className="h-3 w-3" /> Documents
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs gap-1.5" data-testid="tab-history">
              <History className="h-3 w-3" /> History ({history.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <OverviewTab
              claim={claim}
              pro={pro}
              applicablePolicy={applicablePolicy}
              isEditing={isEditing}
              getEditValue={getEditValue}
              setEditValue={setEditValue}
              showLitigationFields={showLitigationFields}
              totalIncurred={totalIncurred}
              settlementSavings={settlementSavings}
              updateMutation={updateMutation}
            />
          </TabsContent>

          <TabsContent value="strategy" className="space-y-4">
            <StrategyTab
              claim={claim}
              isEditing={isEditing}
              getEditValue={getEditValue}
              setEditValue={setEditValue}
            />
          </TabsContent>

          <TabsContent value="notes" className="space-y-4">
            <NotesTab
              notes={notes}
              newNoteContent={newNoteContent}
              setNewNoteContent={setNewNoteContent}
              newNoteType={newNoteType}
              setNewNoteType={setNewNoteType}
              newNoteAuthor={newNoteAuthor}
              setNewNoteAuthor={setNewNoteAuthor}
              handleAddNote={handleAddNote}
              addNotePending={addNoteMutation.isPending}
              toggleNote={toggleNoteMutation.mutate}
            />
          </TabsContent>

          <TabsContent value="compliance">
            <ComplianceTab claim={claim} updateMutation={updateMutation} />
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            <DocumentsTab claimId={id!} />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab history={history} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
