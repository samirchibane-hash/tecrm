import { completionMeta } from "@/lib/taskCompletion";

/** One muted line under a finished task. Renders nothing when every part is unknown. */
export function TaskCompletionMeta({
  completed,
  completedAt,
  completedBy,
  category = null,
}: {
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  /** Pass only when this row does not already show the category chip. */
  category?: string | null;
}) {
  const text = completionMeta({ completed, completedAt, completedBy, category });
  if (!text) return null;
  return <p className="truncate text-xs text-muted-foreground">{text}</p>;
}
