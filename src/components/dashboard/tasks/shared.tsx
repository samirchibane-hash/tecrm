import { format, isPast, isToday } from "date-fns";
import { cn } from "@/lib/utils";
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
  account_name: string | null;
  category: string | null;
  assigned_to: string | null;
  priority: string;
  completed: boolean;
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
