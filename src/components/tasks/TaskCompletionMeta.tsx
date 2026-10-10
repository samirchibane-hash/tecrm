import { completionMeta } from "@/lib/taskCompletion";

/** One muted line under a finished task. Renders nothing when every part is unknown. */
export function TaskCompletionMeta({
  completed,
  completedAt,
  completedBy,
  assignee = null,
  botNames,
  category = null,
}: {
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  assignee?: string | null;
  /** Treat Engine bot first names from the roster. */
  botNames?: readonly string[];
  /** Pass only when this row does not already show the category chip. */
  category?: string | null;
}) {
  const text = completionMeta({ completed, completedAt, completedBy, assignee, botNames, category });
  if (!text) return null;
  return <p className="truncate text-xs text-muted-foreground">{text}</p>;
}
