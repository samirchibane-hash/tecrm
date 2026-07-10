import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { File as FileIcon, MessageSquare, Paperclip, Pencil, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CommentAttachment,
  TaskComment,
  formatFileSize,
  renderWithLinks,
} from "./shared";

// Threaded comment list + composer for a task, restyled to live inside the
// detail sheet. Mirrors the creative request sheet's Comments section, but
// keeps task-specific file attachments.
export function TaskComments({
  taskId,
  onCommentCountChange,
}: {
  taskId: string;
  onCommentCountChange?: () => void;
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComments();
  }, [taskId]);

  async function loadComments() {
    setIsLoading(true);
    const { data } = await supabase
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    setComments(
      (data ?? []).map((c) => ({
        ...c,
        attachments: Array.isArray(c.attachments) ? (c.attachments as CommentAttachment[]) : [],
      }))
    );
    setIsLoading(false);
  }

  async function handleDeleteComment(id: string) {
    await supabase.from("task_comments").delete().eq("id", id);
    loadComments();
    onCommentCountChange?.();
  }

  async function handleEditComment(id: string, newBody: string) {
    await supabase.from("task_comments").update({ body: newBody }).eq("id", id);
    loadComments();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPendingFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  }

  async function postComment() {
    if (!body.trim() && pendingFiles.length === 0) return;
    setIsPosting(true);

    const attachments: CommentAttachment[] = [];
    for (const file of pendingFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${taskId}/${Date.now()}_${safeName}`;
      const { data, error } = await supabase.storage
        .from("task-attachments")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (!error && data) {
        const { data: urlData } = supabase.storage.from("task-attachments").getPublicUrl(data.path);
        attachments.push({ name: file.name, url: urlData.publicUrl, size: file.size, type: file.type });
      }
    }

    await supabase.from("task_comments").insert({ task_id: taskId, body: body.trim(), attachments });

    setBody("");
    setPendingFiles([]);
    setIsPosting(false);
    await loadComments();
    onCommentCountChange?.();
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  const canPost = (body.trim().length > 0 || pendingFiles.length > 0) && !isPosting;

  return (
    <section className="pb-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" /> Comments
      </h3>

      {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Loading…</p>}

      {!isLoading && comments.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No comments yet. Add a note, link, or file below.
        </p>
      )}

      {!isLoading && comments.length > 0 && (
        <div className="space-y-3">
          {comments.map((c) => (
            <CommentBubble
              key={c.id}
              comment={c}
              onDelete={handleDeleteComment}
              onSave={handleEditComment}
            />
          ))}
          <div ref={endRef} />
        </div>
      )}

      {/* Composer */}
      <div className="mt-4 rounded-lg border border-border bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring/50 transition-shadow">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment();
          }}
          placeholder="Add a note or comment… paste a link and it'll be clickable"
          rows={3}
          className="w-full resize-none px-3 pt-2.5 pb-1.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none leading-relaxed"
        />

        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {pendingFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 text-[11px] bg-muted rounded-md px-2 py-1 text-muted-foreground border border-border/50"
              >
                <FileIcon className="h-3 w-3 shrink-0 text-blue-500" />
                <span className="max-w-[120px] truncate font-medium">{f.name}</span>
                <span className="text-muted-foreground/60">{formatFileSize(f.size)}</span>
                <button
                  onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="hover:text-destructive ml-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-2 py-1.5 border-t border-border/40 bg-muted/20">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1.5 py-1 rounded hover:bg-muted"
            title="Attach a file"
          >
            <Paperclip className="h-3.5 w-3.5" />
            <span>Attach</span>
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/40 hidden sm:block select-none">⌘↵ to post</span>
            <Button size="sm" className="h-7 text-xs px-3" onClick={postComment} disabled={!canPost}>
              {isPosting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function CommentBubble({
  comment,
  onDelete,
  onSave,
}: {
  comment: TaskComment;
  onDelete: (id: string) => void;
  onSave: (id: string, body: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const timeLabel = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });

  function openEdit() {
    setEditBody(comment.body);
    setIsEditing(true);
    setTimeout(() => editRef.current?.focus(), 40);
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditBody(comment.body);
  }

  function saveEdit() {
    if (!editBody.trim()) return;
    onSave(comment.id, editBody.trim());
    setIsEditing(false);
  }

  return (
    <div
      className="rounded-xl border border-border bg-muted/30 px-4 py-3 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] text-muted-foreground/70 tabular-nums">{timeLabel}</span>
        {!isEditing && (
          <div
            className={cn(
              "flex items-center gap-0.5 transition-opacity",
              hovered ? "opacity-100" : "opacity-0"
            )}
          >
            <button
              onClick={openEdit}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Edit comment"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => onDelete(comment.id)}
              className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
              title="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-1.5">
          <textarea
            ref={editRef}
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit();
              if (e.key === "Escape") cancelEdit();
            }}
            rows={3}
            className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 leading-relaxed"
          />
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" className="h-6 text-xs px-2" onClick={saveEdit} disabled={!editBody.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        comment.body && (
          <p className="text-sm text-foreground leading-relaxed break-words whitespace-pre-wrap">
            {renderWithLinks(comment.body)}
          </p>
        )
      )}

      {comment.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2">
          {comment.attachments.map((att, i) => (
            <a
              key={i}
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] bg-muted hover:bg-muted/70 text-muted-foreground hover:text-foreground rounded-md px-2 py-1 transition-colors border border-border/40"
            >
              <FileIcon className="h-3 w-3 shrink-0 text-blue-500" />
              <span className="max-w-[160px] truncate font-medium">{att.name}</span>
              <span className="text-muted-foreground/50">{formatFileSize(att.size)}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
