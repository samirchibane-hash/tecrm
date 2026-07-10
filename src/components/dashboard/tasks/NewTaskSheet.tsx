import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, ListTodo, Loader2, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Json } from "@/integrations/supabase/types";
import type { ChangeLogOption } from "@/hooks/useSettings";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import { CategorySelect, FileChip, Priority, PrioritySegmented, uploadAttachments } from "./shared";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: { account_name: string }[];
  changeLogOptions: ChangeLogOption[];
}

export function NewTaskSheet({ open, onOpenChange, accounts, changeLogOptions }: Props) {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [account, setAccount] = useState("");
  const [category, setCategory] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    onOpenChange(false);
    setTitle("");
    setDescription("");
    setPriority("medium");
    setAccount("");
    setCategory("");
    setAssignedTo("");
    setDueDate("");
    setPendingFiles([]);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setPendingFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])]);
    e.target.value = "";
  }

  const createTask = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          account_name: account || null,
          category: category || null,
          assigned_to: assignedTo || null,
          due_date: dueDate || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Files can only be uploaded once the task has an id; attach them, then
      // write the metadata back onto the new row.
      if (data && pendingFiles.length > 0) {
        const uploaded = await uploadAttachments(data.id, pendingFiles, "desc/");
        if (uploaded.length > 0) {
          await supabase
            .from("tasks")
            .update({ description_attachments: uploaded as unknown as Json })
            .eq("id", data.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      reset();
      toast.success("Task created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canCreate = title.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 shrink-0 bg-primary/10">
              <ListTodo className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">New Task</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Add a to-do for you or the team.</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Task</label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canCreate && !createTask.isPending) createTask.mutate();
              }}
              placeholder="What needs to get done?"
              className="text-sm h-10"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Description <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details, context, or a checklist… paste a link and it'll be clickable"
              className="text-sm min-h-[88px] resize-y"
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {pendingFiles.map((f, i) => (
                <FileChip
                  key={i}
                  name={f.name}
                  size={f.size}
                  onRemove={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md border border-dashed border-border hover:bg-muted/40"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Attach file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <PrioritySegmented value={priority} onChange={setPriority} />
          </div>

          {/* Account */}
          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Account <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
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
              <label className="text-xs font-medium text-muted-foreground">
                Category <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <CategorySelect
                value={category}
                onChange={setCategory}
                options={changeLogOptions}
                className="w-full"
              />
            </div>
          )}

          {/* Assignee */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Assign to <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <AssigneeSelect value={assignedTo} onChange={setAssignedTo} className="w-full" />
          </div>

          {/* Due date */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3 w-3" /> Due date <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="text-sm h-9 px-2 rounded-md border border-border bg-background text-foreground"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end gap-2">
          <Button variant="outline" onClick={reset}>Cancel</Button>
          <Button onClick={() => createTask.mutate()} disabled={!canCreate || createTask.isPending} className="gap-1.5">
            {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListTodo className="h-4 w-4" />}
            {createTask.isPending ? "Creating…" : "Create Task"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
