import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow, isPast, isToday } from "date-fns";
import {
  CheckCircle2,
  Circle,
  File as FileIcon,
  ListTodo,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getPalette } from "@/components/dashboard/AccountCard";
import type { ChangeLogOption } from "@/hooks/useSettings";

type Priority = "low" | "medium" | "high";
type Filter = "active" | "all" | "done";

// Separator used to encode a "Category › Sub-option" path in a single field.
const CAT_SEP = " › ";

interface Task {
  id: string;
  title: string;
  account_name: string | null;
  category: string | null;
  priority: string;
  completed: boolean;
  due_date: string | null;
  created_at: string;
}

interface CommentAttachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

interface TaskComment {
  id: string;
  task_id: string;
  body: string;
  attachments: CommentAttachment[];
  created_at: string;
}

const PRIORITY = {
  high: { label: "High", dot: "bg-red-500", ring: "bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300" },
  medium: { label: "Med", dot: "bg-amber-500", ring: "bg-amber-100 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300" },
  low: { label: "Low", dot: "bg-sky-500", ring: "bg-sky-100 dark:bg-sky-950 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300" },
};

interface TaskListProps {
  accounts: { account_name: string }[];
  changeLogOptions?: ChangeLogOption[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderWithLinks(text: string): React.ReactNode[] {
  const urlPattern = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  const parts = text.split(urlPattern);
  const urls = text.match(urlPattern) ?? [];
  const result: React.ReactNode[] = [];
  parts.forEach((part, i) => {
    if (part) result.push(part);
    if (urls[i]) {
      result.push(
        <a
          key={i}
          href={urls[i]}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-blue-500 underline hover:text-blue-600 dark:text-blue-400 break-all"
        >
          {urls[i]}
        </a>
      );
    }
  });
  return result;
}

// Grouped native dropdown fed by the Change Log Options configured in Settings.
// Each category becomes an <optgroup>; sub-options are encoded as "Category › Sub".
function CategorySelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ChangeLogOption[];
}) {
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs h-7 px-2 rounded border border-border bg-background text-foreground max-w-[160px]"
    >
      <option value="">No category</option>
      {options.map((opt) =>
        opt.sub_options.length > 0 ? (
          <optgroup key={opt.label} label={opt.label}>
            <option value={opt.label}>{opt.label} (general)</option>
            {opt.sub_options.map((sub) => (
              <option key={sub} value={`${opt.label}${CAT_SEP}${sub}`}>
                {sub}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={opt.label} value={opt.label}>
            {opt.label}
          </option>
        )
      )}
    </select>
  );
}

// Colored pill for a task's Change Log category, matching the palette used
// across the dashboard (color keyed on the top-level category).
function CategoryBadge({
  category,
  options,
}: {
  category: string;
  options: ChangeLogOption[];
}) {
  const [topLabel, ...rest] = category.split(CAT_SEP);
  const leaf = rest.length > 0 ? rest.join(CAT_SEP) : topLabel;
  const pal = getPalette(topLabel, options);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium max-w-[130px]",
        pal.badge
      )}
      title={category}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", pal.dot)} />
      <span className="truncate">{leaf}</span>
    </span>
  );
}

export function TaskList({ accounts, changeLogOptions = [] }: TaskListProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newAccount, setNewAccount] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  const { data: tasks = [], refetch } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("completed", { ascending: true })
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Task[];
    },
  });

  const { data: commentCounts = {}, refetch: refetchCounts } = useQuery({
    queryKey: ["task-comment-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("task_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data ?? []).forEach(({ task_id }) => {
        counts[task_id] = (counts[task_id] ?? 0) + 1;
      });
      return counts;
    },
  });

  const filtered = tasks.filter((t) => {
    if (filter === "active") return !t.completed;
    if (filter === "done") return t.completed;
    return true;
  });

  const activeCount = tasks.filter((t) => !t.completed).length;
  const doneCount = tasks.filter((t) => t.completed).length;

  function openAdd() {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 40);
  }

  function cancelAdd() {
    setIsAdding(false);
    setNewTitle("");
    setNewPriority("medium");
    setNewAccount("");
    setNewCategory("");
    setNewDueDate("");
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await supabase.from("tasks").insert({
      title: newTitle.trim(),
      priority: newPriority,
      account_name: newAccount || null,
      category: newCategory || null,
      due_date: newDueDate || null,
    });
    cancelAdd();
    refetch();
  }

  async function handleToggle(task: Task) {
    await supabase
      .from("tasks")
      .update({ completed: !task.completed, updated_at: new Date().toISOString() })
      .eq("id", task.id);
    refetch();
  }

  async function handleSave(
    id: string,
    updates: { title: string; priority: string; account_name: string | null; category: string | null; due_date: string | null }
  ) {
    await supabase
      .from("tasks")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);
    refetch();
  }

  async function handleDelete(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    refetch();
  }

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/60">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Tasks</span>
          {activeCount > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {([
            { key: "active" as Filter, label: activeCount > 0 ? `Active (${activeCount})` : "Active" },
            { key: "all" as Filter, label: "All" },
            { key: "done" as Filter, label: doneCount > 0 ? `Done (${doneCount})` : "Done" },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-md transition-colors",
                filter === key
                  ? "bg-background text-foreground font-medium shadow-sm border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-border/40">
        {filtered.length === 0 && !isAdding && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {filter === "active"
              ? "No open tasks — you're all clear."
              : filter === "done"
              ? "No completed tasks yet."
              : "No tasks yet. Add one below."}
          </p>
        )}

        {filtered.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            accounts={accounts}
            changeLogOptions={changeLogOptions}
            commentCount={commentCounts[task.id] ?? 0}
            onToggle={handleToggle}
            onSave={handleSave}
            onDelete={handleDelete}
            onCommentCountChange={refetchCounts}
          />
        ))}

        {/* Add form */}
        {isAdding && (
          <div className="px-4 py-3 space-y-2.5 bg-muted/20">
            <Input
              ref={inputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") cancelAdd();
              }}
              placeholder="Task title…"
              className="h-8 text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                {(["low", "medium", "high"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewPriority(p)}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded border transition-colors",
                      newPriority === p ? PRIORITY[p].ring : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {PRIORITY[p].label}
                  </button>
                ))}
              </div>

              {accounts.length > 0 && (
                <select
                  value={newAccount}
                  onChange={(e) => setNewAccount(e.target.value)}
                  className="text-xs h-7 px-2 rounded border border-border bg-background text-foreground"
                >
                  <option value="">No account</option>
                  {accounts.map((a) => (
                    <option key={a.account_name} value={a.account_name}>
                      {a.account_name}
                    </option>
                  ))}
                </select>
              )}

              <CategorySelect
                value={newCategory}
                onChange={setNewCategory}
                options={changeLogOptions}
              />

              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="text-xs h-7 px-2 rounded border border-border bg-background text-foreground"
              />

              <div className="ml-auto flex gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelAdd}>
                  Cancel
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={!newTitle.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer add trigger */}
      {!isAdding && (
        <button
          onClick={openAdd}
          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/40"
        >
          <Plus className="h-3.5 w-3.5" />
          Add task
        </button>
      )}
    </div>
  );
}

function TaskRow({
  task,
  accounts,
  changeLogOptions,
  commentCount,
  onToggle,
  onSave,
  onDelete,
  onCommentCountChange,
}: {
  task: Task;
  accounts: { account_name: string }[];
  changeLogOptions: ChangeLogOption[];
  commentCount: number;
  onToggle: (t: Task) => void;
  onSave: (id: string, updates: { title: string; priority: string; account_name: string | null; category: string | null; due_date: string | null }) => void;
  onDelete: (id: string) => void;
  onCommentCountChange: () => void;
}) {
  const editTitleRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState<Priority>((task.priority as Priority) ?? "medium");
  const [editAccount, setEditAccount] = useState(task.account_name ?? "");
  const [editCategory, setEditCategory] = useState(task.category ?? "");
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? "");

  const priority = PRIORITY[(task.priority as Priority) ?? "medium"];

  const dueDateInfo = task.due_date
    ? (() => {
        const d = new Date(task.due_date + "T00:00:00");
        if (isToday(d)) return { label: "Today", cls: "text-amber-600 dark:text-amber-400" };
        if (isPast(new Date(task.due_date + "T23:59:59")))
          return { label: format(d, "MMM d"), cls: "text-red-600 dark:text-red-400" };
        return { label: format(d, "MMM d"), cls: "text-muted-foreground" };
      })()
    : null;

  function openEdit() {
    setEditTitle(task.title);
    setEditPriority((task.priority as Priority) ?? "medium");
    setEditAccount(task.account_name ?? "");
    setEditCategory(task.category ?? "");
    setEditDueDate(task.due_date ?? "");
    setIsEditing(true);
    setTimeout(() => editTitleRef.current?.focus(), 40);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  function saveEdit() {
    if (!editTitle.trim()) return;
    onSave(task.id, {
      title: editTitle.trim(),
      priority: editPriority,
      account_name: editAccount || null,
      category: editCategory || null,
      due_date: editDueDate || null,
    });
    setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="px-4 py-3 space-y-2.5 bg-muted/20 border-l-2 border-primary/40">
        <Input
          ref={editTitleRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          className="h-8 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            {(["low", "medium", "high"] as Priority[]).map((p) => (
              <button
                key={p}
                onClick={() => setEditPriority(p)}
                className={cn(
                  "text-xs px-2 py-0.5 rounded border transition-colors",
                  editPriority === p ? PRIORITY[p].ring : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {PRIORITY[p].label}
              </button>
            ))}
          </div>

          {accounts.length > 0 && (
            <select
              value={editAccount}
              onChange={(e) => setEditAccount(e.target.value)}
              className="text-xs h-7 px-2 rounded border border-border bg-background text-foreground"
            >
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.account_name} value={a.account_name}>
                  {a.account_name}
                </option>
              ))}
            </select>
          )}

          <CategorySelect
            value={editCategory}
            onChange={setEditCategory}
            options={changeLogOptions}
          />

          <input
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            className="text-xs h-7 px-2 rounded border border-border bg-background text-foreground"
          />

          <div className="ml-auto flex gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={saveEdit} disabled={!editTitle.trim()}>
              Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("transition-colors", showComments && "bg-muted/10")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Main task row */}
      <div className={cn("flex items-center gap-3 px-4 py-2.5 transition-colors", hovered && !showComments && "bg-muted/20")}>
        <button
          onClick={() => onToggle(task)}
          className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
        >
          {task.completed ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>

        <span
          className={cn(
            "flex-1 text-sm min-w-0 truncate",
            task.completed ? "line-through text-muted-foreground opacity-55" : "text-foreground"
          )}
        >
          {task.title}
        </span>

        <div className="flex items-center gap-2 shrink-0 text-xs">
          {task.account_name && (
            <span className="px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-medium max-w-[110px] truncate">
              {task.account_name}
            </span>
          )}
          {task.category && (
            <CategoryBadge category={task.category} options={changeLogOptions} />
          )}
          <span
            className={cn("inline-block h-2 w-2 rounded-full shrink-0", priority.dot)}
            title={`${priority.label} priority`}
          />
          {dueDateInfo && (
            <span className={cn("text-[11px] tabular-nums", dueDateInfo.cls)}>
              {dueDateInfo.label}
            </span>
          )}

          {/* Comment toggle */}
          <button
            onClick={() => setShowComments((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded px-1 py-0.5 transition-colors",
              showComments
                ? "text-primary"
                : commentCount > 0
                ? "text-muted-foreground hover:text-foreground"
                : "text-muted-foreground/40 hover:text-muted-foreground"
            )}
            title={showComments ? "Hide comments" : "Show comments"}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {commentCount > 0 && (
              <span className="text-[10px] font-semibold tabular-nums leading-none">{commentCount}</span>
            )}
          </button>
        </div>

        {/* Edit button — visible on hover */}
        <button
          onClick={openEdit}
          className={cn(
            "shrink-0 text-muted-foreground hover:text-foreground transition-all",
            hovered ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          title="Edit task"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        {/* Delete button — visible on hover */}
        <button
          onClick={() => onDelete(task.id)}
          className={cn(
            "shrink-0 text-muted-foreground hover:text-destructive transition-all",
            hovered ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          title="Delete task"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Inline comments panel */}
      {showComments && (
        <CommentsPanel taskId={task.id} onCommentAdded={onCommentCountChange} />
      )}
    </div>
  );
}

function CommentsPanel({
  taskId,
  onCommentAdded,
}: {
  taskId: string;
  onCommentAdded: () => void;
}) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [body, setBody] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadComments();
    setTimeout(() => textareaRef.current?.focus(), 60);
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
    onCommentAdded();
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
        const { data: urlData } = supabase.storage
          .from("task-attachments")
          .getPublicUrl(data.path);
        attachments.push({ name: file.name, url: urlData.publicUrl, size: file.size, type: file.type });
      }
    }

    await supabase.from("task_comments").insert({
      task_id: taskId,
      body: body.trim(),
      attachments,
    });

    setBody("");
    setPendingFiles([]);
    setIsPosting(false);
    loadComments();
    onCommentAdded();
  }

  const canPost = (body.trim().length > 0 || pendingFiles.length > 0) && !isPosting;

  return (
    <div className="border-t border-border/40 bg-muted/5 px-4 pt-3 pb-3 space-y-3">
      {/* Comment list */}
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : comments.length > 0 ? (
        <div className="space-y-3">
          {comments.map((c) => (
            <CommentBubble
              key={c.id}
              comment={c}
              onDelete={handleDeleteComment}
              onSave={handleEditComment}
            />
          ))}
        </div>
      ) : null}

      {/* Composer */}
      <div className="rounded-lg border border-border/60 bg-background overflow-hidden focus-within:ring-1 focus-within:ring-ring/50 transition-shadow">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postComment();
          }}
          placeholder="Add a note or comment… paste a link and it'll be clickable"
          rows={2}
          className="w-full resize-none px-3 pt-2.5 pb-1.5 text-sm bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none leading-relaxed"
        />

        {/* Queued file chips */}
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

        {/* Toolbar */}
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
            <Button size="sm" className="h-6 text-xs px-3" onClick={postComment} disabled={!canPost}>
              {isPosting ? "Posting…" : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
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
      className="flex gap-2.5 group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-muted border border-border/60 flex items-center justify-center">
        <MessageSquare className="h-2.5 w-2.5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        {/* Header: timestamp + actions */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/70 tabular-nums">{timeLabel}</span>
          {!isEditing && hovered && (
            <div className="flex items-center gap-0.5 ml-auto">
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

        {/* Body — view or edit */}
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
              className="w-full resize-none rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50 leading-relaxed"
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

        {/* Attachments (always visible, read-only) */}
        {comment.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
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
    </div>
  );
}
