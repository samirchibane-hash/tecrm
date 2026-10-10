import { completionMeta } from "@/lib/taskCompletion";

/** One muted line under a finished task. Renders nothing when the date and the person are both unknown. */
export function TaskCompletionMeta({
  completed,
  completedAt,
  completedBy,
}: {
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
}) {
  const text = completionMeta({ completed, completedAt, completedBy });
  if (!text) return null;
  return <p className="truncate text-xs text-muted-foreground">{text}</p>;
}
