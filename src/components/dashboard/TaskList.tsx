import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlignLeft, CheckCircle2, Circle, ListTodo, MessageSquare, Paperclip, Plus, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { ChangeLogOption } from "@/hooks/useSettings";
import { TaskDetailSheet } from "@/components/dashboard/tasks/TaskDetailSheet";
import { NewTaskSheet } from "@/components/dashboard/tasks/NewTaskSheet";
import {
  CategoryBadge,
  PRIORITY,
  Task,
  TaskFilter,
  getDueDateInfo,
  priorityOf,
  toAttachments,
} from "@/components/dashboard/tasks/shared";

interface TaskListProps {
  accounts: { account_name: string }[];
  changeLogOptions?: ChangeLogOption[];
}

export function TaskList({ accounts, changeLogOptions = [] }: TaskListProps) {
  const [filter, setFilter] = useState<TaskFilter>("active");
  const [newOpen, setNewOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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
      return (data ?? []).map((t) => ({
        ...t,
        description_attachments: toAttachments(t.description_attachments),
      })) as Task[];
    },
  });

  const { data: commentCounts = {}, refetch: refetchCounts } = useQuery({
    queryKey: ["task-comment-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_comments").select("task_id");
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

  // Quick-toggle straight from the row without opening the sheet.
  async function handleToggle(task: Task) {
    await supabase
      .from("tasks")
      .update({ completed: !task.completed, updated_at: new Date().toISOString() })
      .eq("id", task.id);
    refetch();
    if (selectedTask?.id === task.id) {
      setSelectedTask({ ...selectedTask, completed: !task.completed });
    }
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
            { key: "active" as TaskFilter, label: activeCount > 0 ? `Active (${activeCount})` : "Active" },
            { key: "all" as TaskFilter, label: "All" },
            { key: "done" as TaskFilter, label: doneCount > 0 ? `Done (${doneCount})` : "Done" },
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
        {filtered.length === 0 && (
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
            changeLogOptions={changeLogOptions}
            commentCount={commentCounts[task.id] ?? 0}
            onToggle={handleToggle}
            onOpen={() => setSelectedTask(task)}
          />
        ))}
      </div>

      {/* Footer add trigger */}
      <button
        onClick={() => setNewOpen(true)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border/40"
      >
        <Plus className="h-3.5 w-3.5" />
        Add task
      </button>

      {/* Create side panel */}
      <NewTaskSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        accounts={accounts}
        changeLogOptions={changeLogOptions}
      />

      {/* Detail / edit side panel */}
      <TaskDetailSheet
        task={selectedTask}
        accounts={accounts}
        changeLogOptions={changeLogOptions}
        onClose={() => setSelectedTask(null)}
        onTaskChange={(updated) => {
          setSelectedTask(updated);
          refetch();
        }}
        onCommentCountChange={refetchCounts}
      />
    </div>
  );
}

function TaskRow({
  task,
  changeLogOptions,
  commentCount,
  onToggle,
  onOpen,
}: {
  task: Task;
  changeLogOptions: ChangeLogOption[];
  commentCount: number;
  onToggle: (t: Task) => void;
  onOpen: () => void;
}) {
  const priority = PRIORITY[priorityOf(task.priority)];
  const dueInfo = getDueDateInfo(task.due_date);

  return (
    <div
      onClick={onOpen}
      className="group flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(task);
        }}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
        title={task.completed ? "Mark active" : "Mark complete"}
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
        {task.category && <CategoryBadge category={task.category} options={changeLogOptions} />}
        {task.description && (
          <AlignLeft
            className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0"
            aria-label="Has description"
          />
        )}
        {task.description_attachments.length > 0 && (
          <span
            className="flex items-center gap-0.5 text-muted-foreground/60 shrink-0"
            title={`${task.description_attachments.length} attachment${task.description_attachments.length === 1 ? "" : "s"}`}
          >
            <Paperclip className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold tabular-nums leading-none">
              {task.description_attachments.length}
            </span>
          </span>
        )}
        {task.assigned_to && (
          <span
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[11px] font-medium max-w-[110px]"
            title={`Assigned to ${task.assigned_to}`}
          >
            <User className="h-2.5 w-2.5 shrink-0" />
            <span className="truncate">{task.assigned_to}</span>
          </span>
        )}
        <span
          className={cn("inline-block h-2 w-2 rounded-full shrink-0", priority.dot)}
          title={`${priority.label} priority`}
        />
        {dueInfo && (
          <span className={cn("text-[11px] tabular-nums", dueInfo.cls)}>{dueInfo.label}</span>
        )}
        <span
          className={cn(
            "flex items-center gap-1 rounded px-1 py-0.5",
            commentCount > 0 ? "text-muted-foreground" : "text-muted-foreground/40"
          )}
          title={commentCount > 0 ? `${commentCount} comment${commentCount === 1 ? "" : "s"}` : "No comments"}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {commentCount > 0 && (
            <span className="text-[10px] font-semibold tabular-nums leading-none">{commentCount}</span>
          )}
        </span>
      </div>
    </div>
  );
}
