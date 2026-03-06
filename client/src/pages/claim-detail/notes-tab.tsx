import { Plus, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NOTE_TYPE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/formatters";
import { formatDateTime } from "./helpers";
import type { ClaimNote } from "@shared/schema";

interface NotesTabProps {
  notes: ClaimNote[];
  newNoteContent: string;
  setNewNoteContent: (v: string) => void;
  newNoteType: string;
  setNewNoteType: (v: string) => void;
  newNoteAuthor: string;
  setNewNoteAuthor: (v: string) => void;
  handleAddNote: () => void;
  addNotePending: boolean;
  toggleNote: (args: { noteId: number; completed: boolean }) => void;
}

export function NotesTab({
  notes,
  newNoteContent,
  setNewNoteContent,
  newNoteType,
  setNewNoteType,
  newNoteAuthor,
  setNewNoteAuthor,
  handleAddNote,
  addNotePending,
  toggleNote,
}: NotesTabProps) {
  return (
    <div className="space-y-4">
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
            disabled={!newNoteContent.trim() || !newNoteAuthor.trim() || addNotePending}
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
                          toggleNote({ noteId: note.id, completed: !!checked })
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
    </div>
  );
}
