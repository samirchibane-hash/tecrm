import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { SheetTitle } from "@/components/ui/sheet";
import { Loader2, Check, ChevronsUpDown, Plus, Trash2, ArrowLeft } from "lucide-react";
import type { OptionType } from "./creativeOptions";

// ── Combobox ──────────────────────────────────────────────────────────────────
// Searchable single-select that can also add a new value inline.

export function Combobox({
  value, onChange, options, placeholder, searchPlaceholder, emptyText, onAddNew,
}: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder: string; searchPlaceholder: string; emptyText: string;
  onAddNew?: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = options.filter((o) => o.toLowerCase().includes(search.toLowerCase()));
  const canAdd = onAddNew && search.trim() && !options.some(
    (o) => o.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline" role="combobox" aria-expanded={open}
          className="w-full justify-between font-normal text-sm h-9"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} className="h-8 text-sm" />
          <CommandList>
            <CommandEmpty><span className="text-xs text-muted-foreground">{emptyText}</span></CommandEmpty>
            <CommandGroup>
              {filtered.map((opt) => (
                <CommandItem key={opt} value={opt} onSelect={(v) => { onChange(v === value ? "" : v); setSearch(""); setOpen(false); }} className="text-sm">
                  <Check className={cn("mr-2 h-3.5 w-3.5 shrink-0", value === opt ? "opacity-100" : "opacity-0")} />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
            {canAdd && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value={`__add__${search}`}
                    onSelect={() => { onAddNew!(search.trim()); onChange(search.trim()); setSearch(""); setOpen(false); }}
                    className="text-sm text-primary"
                  >
                    <Plus className="mr-2 h-3.5 w-3.5 shrink-0" />
                    Add &ldquo;{search.trim()}&rdquo;
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Manage panel ──────────────────────────────────────────────────────────────
// A full-height sheet view for adding/removing option values. Rendered inside
// whichever Sheet hosts it (New Brief, New Template) as a swapped-in view.

export function ManagePanel({
  optionType, title, onBack, backLabel = "← Back",
}: {
  optionType: OptionType; title: string; onBack: () => void; backLabel?: string;
}) {
  const queryClient = useQueryClient();
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: options = [], isLoading } = useQuery({
    queryKey: ["creative-options", optionType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creative_options").select("id, value").eq("type", optionType).order("value");
      if (error) throw error;
      return data as { id: string; value: string }[];
    },
  });

  const addOption = async () => {
    const val = newValue.trim();
    if (!val) return;
    setAdding(true);
    const { error } = await supabase.from("creative_options").insert({ type: optionType, value: val });
    if (error) { toast.error(error.message); } else {
      queryClient.invalidateQueries({ queryKey: ["creative-options", optionType] });
      setNewValue("");
    }
    setAdding(false);
  };

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("creative_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-options", optionType] });
      setConfirmDeleteId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="rounded-md p-1 hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <SheetTitle className="text-base font-semibold">{title}</SheetTitle>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex gap-2">
          <Input
            placeholder="Add new option…"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addOption()}
            className="text-sm h-9"
          />
          <Button size="sm" className="h-9 px-3 shrink-0" onClick={addOption} disabled={!newValue.trim() || adding}>
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          </Button>
        </div>

        <div className="space-y-0.5 mt-2">
          {isLoading && (
            <div className="space-y-1.5 py-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />)}
            </div>
          )}
          {!isLoading && options.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No options yet. Add one above.</p>
          )}
          {!isLoading && options.map((opt) => (
          <div
            key={opt.id}
            className={cn(
              "group flex items-center justify-between gap-2 rounded-md px-3 py-2.5 transition-colors",
              confirmDeleteId === opt.id ? "bg-destructive/5 border border-destructive/20" : "hover:bg-muted/50"
            )}
          >
            <span className="text-sm truncate">{opt.value}</span>
            {confirmDeleteId === opt.id ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-destructive font-medium">Delete?</span>
                <Button size="sm" variant="destructive" className="h-6 px-2 text-xs"
                  onClick={() => deleteOption.mutate(opt.id)} disabled={deleteOption.isPending}>
                  {deleteOption.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Yes"}
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setConfirmDeleteId(null)}>No</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0 opacity-0 group-hover:opacity-100"
                onClick={() => setConfirmDeleteId(opt.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
        </div>
      </div>

      <div className="border-t border-border px-6 py-4 flex justify-end shrink-0">
        <Button variant="outline" size="sm" onClick={onBack}>{backLabel}</Button>
      </div>
    </>
  );
}
