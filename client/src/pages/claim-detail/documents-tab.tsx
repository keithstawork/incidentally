import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "./helpers";
import type { Document } from "@shared/schema";

const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  medical: "Medical",
  legal: "Legal",
  adjuster: "Adjuster",
  insurance: "Insurance",
  internal: "Internal",
  photo: "Photo",
  other: "Other",
};

const CATEGORIES = Object.keys(DOCUMENT_CATEGORY_LABELS).sort();

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentsTabProps {
  claimId: string;
}

export function DocumentsTab({ claimId }: DocumentsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadNotes, setUploadNotes] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: ["/api/claims", claimId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/claims/${claimId}/documents`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      category,
      notes,
    }: {
      file: File;
      category: string;
      notes: string;
    }) => {
      const form = new FormData();
      form.append("file", file);
      form.append("category", category);
      if (notes.trim()) form.append("notes", notes.trim());
      const res = await fetch(`/api/claims/${claimId}/documents`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", claimId, "documents"] });
      toast({ title: "Document uploaded" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await fetch(`/api/claims/${claimId}/documents/${docId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/claims", claimId, "documents"] });
      toast({ title: "Document removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove document", variant: "destructive" });
    },
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    uploadMutation.mutate(
      { file, category: uploadCategory, notes: uploadNotes },
      { onSuccess: () => setUploadNotes("") },
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setIsDragOver(true);
  };

  const downloadUrl = (docId: number) =>
    `/api/claims/${claimId}/documents/${docId}/download`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Upload document
          </h3>
          <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors cursor-pointer min-h-[100px] ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30 hover:border-muted-foreground/50 hover:bg-muted/50"
              }`}
            >
              <input
                id="doc-file"
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept="*/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    uploadMutation.mutate(
                      { file, category: uploadCategory, notes: uploadNotes },
                      { onSuccess: () => setUploadNotes("") },
                    );
                    e.target.value = "";
                  }
                }}
              />
              {uploadMutation.isPending ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              )}
              <p className="text-sm text-muted-foreground">
                {isDragOver ? "Drop file here" : "Drag and drop a file here, or click to browse"}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="doc-category" className="text-xs">
                  Category (for uploads above)
                </Label>
                <Select value={uploadCategory} onValueChange={setUploadCategory}>
                  <SelectTrigger id="doc-category" className="h-8 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {DOCUMENT_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-notes" className="text-xs">
                Notes (optional)
              </Label>
              <Textarea
                id="doc-notes"
                placeholder="Brief description or context"
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                className="text-xs min-h-[60px]"
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Documents ({documents.length})
          </h3>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No documents yet. Upload a file above to attach it to this incident.
            </p>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}
                      {" · "}
                      {formatBytes(doc.sizeBytes)}
                      {" · "}
                      {formatDateTime(doc.createdAt)}
                      {doc.notes ? ` · ${doc.notes}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a
                        href={downloadUrl(doc.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Remove"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove document?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove &quot;{doc.filename}&quot; from this incident. This
                            action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(doc.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
