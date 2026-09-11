import { useState } from "react";
import { format, isPast, isToday } from "date-fns";
import { CheckCircle2, Circle, ListTodo, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AccountTask } from "./queries";

// Priority reads as a dot plus its word for screen readers and on hover.
const PRIORITY_DOT: Record<string, string> = { high: "bg-danger", medium: "bg-warning", low: "bg-muted-foreground/50" };

/** The client's task list with quick add / complete / delete. */
export function AccountTasksCard({ accountName, tasks, onChange }: { accountName: string; tasks: AccountTask[]; onChange: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const activeCount = tasks.filter((t) => !t.completed).length;

  const reset = () => { setTitle(""); setPriority("medium"); setDueDate(""); setIsAdding(false); };

  async function add() {
    if (!title.trim()) return;
    await supabase.from("tasks").insert({ title: title.trim(), priority, account_name: accountName, due_date: dueDate || null });
    reset();
    onChange();
  }
  async function toggle(task: AccountTask) {
    const completed = !task.completed;
    await supabase.from("tasks").update({ completed, stage: completed ? "launched" : "assigned" }).eq("id", task.id);
    onChange();
  }
  async function remove(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    onChange();
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border/60" aria-labelledby="tasks-heading">
      <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <ListTodo className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 id="tasks-heading" className="text-sm font-semibold text-foreground">Tasks</h2>
          {activeCount > 0 && <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{activeCount}</span>}
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {tasks.length === 0 && !isAdding && <p className="py-6 text-center text-sm text-muted-foreground">No tasks yet.</p>}
        {tasks.map((task) => {
          const due = task.due_date
            ? (() => {
                const d = new Date(task.due_date + "T00:00:00");
                if (isToday(d)) return { label: "Today", cls: "text-warning" };
                if (isPast(new Date(task.due_date + "T23:59:59"))) return { label: format(d, "MMM d"), cls: "text-danger" };
                return { label: format(d, "MMM d"), cls: "text-muted-foreground" };
              })()
            : null;
          return (
            <div key={task.id} className={cn("group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/20", task.completed && "opacity-55")}>
              <button
                onClick={() => toggle(task)}
                aria-label={task.completed ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
                className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {task.completed ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4" />}
              </button>
              <span className={cn("min-w-0 flex-1 truncate text-sm", task.completed ? "text-muted-foreground line-through" : "text-foreground")}>{task.title}</span>
              <div className="flex shrink-0 items-center gap-2 text-xs">
                <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[task.priority] ?? PRIORITY_DOT.medium)} title={`${task.priority} priority`}>
                  <span className="sr-only">{task.priority} priority</span>
                </span>
                {due && <span className={cn("text-[11px] tabular-nums", due.cls)}>{due.label}</span>}
              </div>
              <button
                onClick={() => remove(task.id)}
                aria-label={`Delete "${task.title}"`}
                className="shrink-0 rounded-sm text-muted-foreground opacity-0 transition-all hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {isAdding && (
          <div className="space-y-2.5 bg-muted/20 px-4 py-3">
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") add(); if (e.key === "Escape") reset(); }}
              placeholder="Task title…"
              aria-label="Task title"
              className="h-8 text-sm"
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1" role="group" aria-label="Priority">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    aria-pressed={priority === p}
                    className={cn("rounded border px-2 py-0.5 text-xs capitalize transition-colors", priority === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Due date" className="h-7 rounded border border-border bg-background px-2 text-xs text-foreground" />
              <div className="ml-auto flex gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={reset}>Cancel</Button>
                <Button size="sm" className="h-7 text-xs" onClick={add} disabled={!title.trim()}>Add</Button>
              </div>
            </div>
          </div>
        )}
      </div>
      {!isAdding && (
        <button onClick={() => setIsAdding(true)} className="flex w-full items-center gap-2 border-t border-border/40 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground">
          <Plus className="h-3.5 w-3.5" />
          Add task
        </button>
      )}
    </section>
  );
}
