import { format, isPast, isToday } from "date-fns";
import { File as FileIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { getPalette } from "@/components/dashboard/AccountCard";
import type { ChangeLogOption } from "@/hooks/useSettings";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Priority = "low" | "medium" | "high";
export type TaskFilter = "active" | "all" | "done";

// Separator used to encode a "Category › Sub-option" path in a single field.
export const CAT_SEP = " › ";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  description_attachments: CommentAttachment[];
  account_name: string | null;
  category: string | null;
  assigned_to: string | null;
  priority: string;
  completed: boolean;
  stage: string;
  due_date: string | null;
  created_at: string;
}

export interface CommentAttachment {
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  body: string;
  attachments: CommentAttachment[];
  created_at: string;
}

// ── Priority palette ──────────────────────────────────────────────────────────
// Extends the original dot/ring styling with icon tints (header block) and a
// pill badge, mirroring how the creative sheet tints its header by ad type.

export const PRIORITY: Record<
  Priority,
  { label: string; dot: string; ring: string; iconBg: string; iconText: string; badge: string }
> = {
  high: {
    label: "High",
    dot: "bg-red-500",
    ring: "bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300",
    iconBg: "bg-red-50 dark:bg-red-950/50",
    iconText: "text-red-600 dark:text-red-400",
    badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  medium: {
    label: "Med",
    dot: "bg-amber-500",
    ring: "bg-amber-100 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300",
    iconBg: "bg-amber-50 dark:bg-amber-950/50",
    iconText: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  low: {
    label: "Low",
    dot: "bg-sky-500",
    ring: "bg-sky-100 dark:bg-sky-950 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300",
    iconBg: "bg-sky-50 dark:bg-sky-950/50",
    iconText: "text-sky-600 dark:text-sky-400",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  },
};

export function priorityOf(p: string | null | undefined): Priority {
  return (p as Priority) in PRIORITY ? (p as Priority) : "medium";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Normalize a raw jsonb value from the DB into a typed attachment list.
export function toAttachments(value: unknown): CommentAttachment[] {
  return Array.isArray(value) ? (value as CommentAttachment[]) : [];
}

// Upload files to the shared task-attachments bucket and return their metadata.
// `prefix` lets callers namespace files (e.g. "desc/") within a task's folder.
export async function uploadAttachments(
  taskId: string,
  files: File[],
  prefix = ""
): Promise<CommentAttachment[]> {
  const uploaded: CommentAttachment[] = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${taskId}/${prefix}${Date.now()}_${safeName}`;
    const { data, error } = await supabase.storage
      .from("task-attachments")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (!error && data) {
      const { data: urlData } = supabase.storage.from("task-attachments").getPublicUrl(data.path);
      uploaded.push({ name: file.name, url: urlData.publicUrl, size: file.size, type: file.type });
    }
  }
  return uploaded;
}

export function renderWithLinks(text: string): React.ReactNode[] {
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

export function getDueDateInfo(due_date: string | null) {
  if (!due_date) return null;
  const d = new Date(due_date + "T00:00:00");
  if (isToday(d)) return { label: "Today", cls: "text-amber-600 dark:text-amber-400" };
  if (isPast(new Date(due_date + "T23:59:59")))
    return { label: format(d, "MMM d"), cls: "text-red-600 dark:text-red-400", overdue: true };
  return { label: format(d, "MMM d"), cls: "text-muted-foreground" };
}

// ── Attachment chip ───────────────────────────────────────────────────────────

// Compact file pill shared by the create + detail sheets. When `href` is set the
// name links out (new tab); otherwise it's a pending, not-yet-uploaded file.
export function FileChip({
  name,
  size,
  href,
  onRemove,
}: {
  name: string;
  size: number;
  href?: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] bg-muted rounded-md pl-2 pr-1.5 py-1 text-muted-foreground border border-border/50 max-w-[200px]">
      <FileIcon className="h-3 w-3 shrink-0 text-blue-500" />
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="truncate font-medium hover:text-foreground hover:underline"
          title={name}
        >
          {name}
        </a>
      ) : (
        <span className="truncate font-medium" title={name}>
          {name}
        </span>
      )}
      <span className="text-muted-foreground/60 shrink-0">{formatFileSize(size)}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 shrink-0 hover:text-destructive transition-colors"
          title="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── Category controls ─────────────────────────────────────────────────────────

// Grouped native dropdown fed by the Change Log Options configured in Settings.
// Each category becomes an <optgroup>; sub-options are encoded as "Category › Sub".
export function CategorySelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ChangeLogOption[];
  className?: string;
}) {
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "text-sm h-9 px-2 rounded-md border border-border bg-background text-foreground",
        className
      )}
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
export function CategoryBadge({
  category,
  options,
  className,
}: {
  category: string;
  options: ChangeLogOption[];
  className?: string;
}) {
  const [topLabel, ...rest] = category.split(CAT_SEP);
  const leaf = rest.length > 0 ? rest.join(CAT_SEP) : topLabel;
  const pal = getPalette(topLabel, options);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium max-w-[130px]",
        pal.badge,
        className
      )}
      title={category}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", pal.dot)} />
      <span className="truncate">{leaf}</span>
    </span>
  );
}

// ── Priority segmented control (shared by create + detail sheets) ─────────────

export function PrioritySegmented({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(["low", "medium", "high"] as Priority[]).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all",
            value === p
              ? cn(PRIORITY[p].ring, "shadow-sm")
              : "border-border text-muted-foreground hover:bg-muted/40 hover:border-muted-foreground/40"
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", PRIORITY[p].dot)} />
          {p === "medium" ? "Medium" : PRIORITY[p].label}
        </button>
      ))}
    </div>
  );
}
