import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isPast, isToday } from "date-fns";
import { CheckCircle2, Circle, ListTodo, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Priority = "low" | "medium" | "high";
type Filter = "active" | "all" | "done";

interface Task {
  id: string;
  title: string;
  account_name: string | null;
  priority: string;
  completed: boolean;
  due_date: string | null;
  created_at: string;
}

const PRIORITY = {
  high: { label: "High", dot: "bg-red-500", ring: "bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-700 dark:text-red-300" },
  medium: { label: "Med", dot: "bg-amber-500", ring: "bg-amber-100 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300" },
  low: { label: "Low", dot: "bg-sky-500", ring: "bg-sky-100 dark:bg-sky-950 border-sky-300 dark:border-sky-700 text-sky-700 dark:text-sky-300" },
};

interface TaskListProps {
  accounts: { account_name: string }[];
}

export function TaskList({ accounts }: TaskListProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>("active");
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newAccount, setNewAccount] = useState("");
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
    setNewDueDate("");
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await supabase.from("tasks").insert({
      title: newTitle.trim(),
      priority: newPriority,
      account_name: newAccount || null,
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
            onToggle={handleToggle}
            onDelete={handleDelete}
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
              {/* Priority selector */}
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

              {/* Account selector */}
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

              {/* Due date */}
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
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleAdd}
                  disabled={!newTitle.trim()}
                >
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
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

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

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-2.5 transition-colors",
        hovered && "bg-muted/20",
        task.completed && "opacity-55"
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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
          task.completed ? "line-through text-muted-foreground" : "text-foreground"
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
        <span
          className={cn("inline-block h-2 w-2 rounded-full shrink-0", priority.dot)}
          title={`${priority.label} priority`}
        />
        {dueDateInfo && (
          <span className={cn("text-[11px] tabular-nums", dueDateInfo.cls)}>
            {dueDateInfo.label}
          </span>
        )}
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className={cn(
          "shrink-0 text-muted-foreground hover:text-destructive transition-all",
          hovered ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
