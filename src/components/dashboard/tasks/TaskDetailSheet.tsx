import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Calendar,
  Check,
  CheckCircle2,
  ListTodo,
  Loader2,
  Trash2,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ChangeLogOption } from "@/hooks/useSettings";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import { TaskComments } from "./TaskComments";
import {
  CategoryBadge,
  CategorySelect,
  PRIORITY,
  PrioritySegmented,
  Priority,
  Task,
  getDueDateInfo,
  priorityOf,
} from "./shared";

interface Props {
  task: Task | null;
  accounts: { account_name: string }[];
  changeLogOptions: ChangeLogOption[];
  onClose: () => void;
  onTaskChange?: (updated: Task) => void;
  onCommentCountChange?: () => void;
}

export function TaskDetailSheet({
  task,
  accounts,
  changeLogOptions,
  onClose,
  onTaskChange,
  onCommentCountChange,
}: Props) {
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Local, editable mirrors of the task's title + description (saved on blur).
  const [title, setTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [description, setDescription] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
    }
  }, [task?.id]);

  const priority = PRIORITY[priorityOf(task?.priority)];
  const dueInfo = getDueDateInfo(task?.due_date ?? null);

  // Single patch mutation — each field saves independently, mirroring the
  // creative sheet's per-field inline saves.
  const patch = useMutation({
    mutationFn: async (updates: Partial<Task>) => {
      if (!task) return;
      const { error } = await supabase
        .from("tasks")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: (_, updates) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      if (task) onTaskChange?.({ ...task, ...updates });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
      setConfirmDelete(false);
      onClose();
    },
    onError: (err: Error) => {
      setConfirmDelete(false);
      toast.error(err.message);
    },
  });

  function saveTitle() {
    if (!task) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === task.title) {
      setTitle(task.title);
      return;
    }
    setSavingTitle(true);
    patch.mutate(
      { title: trimmed },
      {
        onSuccess: () => {
          setSavingTitle(false);
          toast.success("Task updated");
        },
        onError: () => setSavingTitle(false),
      }
    );
  }

  function saveDescription() {
    if (!task) return;
    const trimmed = description.trim();
    const current = task.description ?? "";
    if (trimmed === current) {
      setDescription(current);
      return;
    }
    setSavingDescription(true);
    patch.mutate(
      { description: trimmed || null },
      {
        onSuccess: () => {
          setSavingDescription(false);
          toast.success("Task updated");
        },
        onError: () => setSavingDescription(false),
      }
    );
  }

  return (
    <>
      <Sheet open={!!task} onOpenChange={(open) => { if (!open) onClose(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden">
          {task && (
            <>
              {/* Header */}
              <div className="relative px-6 pt-6 pb-4 border-b border-border shrink-0">
                <div className="flex items-start gap-3 pr-10">
                  <div className={cn("rounded-lg p-2 mt-0.5 shrink-0", priority.iconBg)}>
                    <ListTodo className={cn("h-4 w-4", priority.iconText)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", priority.badge)}>
                        {priority.label} Priority
                      </span>
                      {task.completed ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Completed
                        </span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          Active
                        </span>
                      )}
                      {task.account_name && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground max-w-[140px] truncate">
                          {task.account_name}
                        </span>
                      )}
                      {task.category && <CategoryBadge category={task.category} options={changeLogOptions} />}
                      {task.assigned_to && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground max-w-[140px]">
                          <User className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{task.assigned_to}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Created {format(new Date(task.created_at), "MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-4 right-12 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* Title */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Task</h3>
                  <div className="relative">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setTitle(task.title);
                      }}
                      placeholder="Task title…"
                      className="text-sm h-10 pr-9 font-medium"
                    />
                    {savingTitle && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </section>

                {/* Description */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                    Description
                    {savingDescription && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </h3>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={saveDescription}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setDescription(task.description ?? "");
                    }}
                    placeholder="Add details, context, or a checklist…"
                    className="text-sm min-h-[96px] resize-y"
                  />
                </section>

                {/* Details */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Details</h3>
                  <div className="space-y-4">
                    {/* Priority */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Priority</label>
                      <PrioritySegmented
                        value={priorityOf(task.priority)}
                        onChange={(p: Priority) => patch.mutate({ priority: p })}
                      />
                    </div>

                    {/* Account */}
                    {accounts.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Account</label>
                        <select
                          value={task.account_name ?? ""}
                          onChange={(e) => patch.mutate({ account_name: e.target.value || null })}
                          className="w-full text-sm h-9 px-2 rounded-md border border-border bg-background text-foreground"
                        >
                          <option value="">No account</option>
                          {accounts.map((a) => (
                            <option key={a.account_name} value={a.account_name}>
                              {a.account_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Category */}
                    {changeLogOptions.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-muted-foreground">Category</label>
                        <CategorySelect
                          value={task.category ?? ""}
                          onChange={(v) => patch.mutate({ category: v || null })}
                          options={changeLogOptions}
                          className="w-full"
                        />
                      </div>
                    )}

                    {/* Assignee */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Assign to</label>
                      <AssigneeSelect
                        value={task.assigned_to ?? ""}
                        onChange={(v) => patch.mutate({ assigned_to: v || null })}
                        className="w-full"
                      />
                    </div>

                    {/* Due date */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" /> Due date
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={task.due_date ?? ""}
                          onChange={(e) => patch.mutate({ due_date: e.target.value || null })}
                          className="text-sm h-9 px-2 rounded-md border border-border bg-background text-foreground"
                        />
                        {dueInfo && (
                          <span className={cn("text-xs font-medium tabular-nums", dueInfo.cls)}>
                            {dueInfo.overdue ? `Overdue · ${dueInfo.label}` : dueInfo.label}
                          </span>
                        )}
                        {task.due_date && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => patch.mutate({ due_date: null })}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Completion */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Status</h3>
                  {task.completed ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Completed</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto h-7 text-xs text-muted-foreground"
                        onClick={() => patch.mutate({ completed: false })}
                      >
                        Reopen
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full gap-1.5"
                      onClick={() => {
                        patch.mutate(
                          { completed: true },
                          { onSuccess: () => toast.success("Task completed") }
                        );
                      }}
                      disabled={patch.isPending}
                    >
                      {patch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Mark Complete
                    </Button>
                  )}
                </section>

                {/* Comments */}
                <TaskComments taskId={task.id} onCommentCountChange={onCommentCountChange} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the task and all its comments and attachments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => task && deleteTask.mutate(task.id)}
            >
              {deleteTask.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
