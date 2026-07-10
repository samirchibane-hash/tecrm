import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import { Image as ImageIcon, Film, ClipboardList, Loader2, Check, ChevronsUpDown, Settings2, Plus, Trash2, ArrowLeft } from "lucide-react";

type OptionType = "ad_angle" | "offer_type";
type View = "form" | "manage_angle" | "manage_offer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ── Combobox ──────────────────────────────────────────────────────────────────

function Combobox({
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

// ── Manage panel (rendered inside the same Dialog) ────────────────────────────

function ManagePanel({
  optionType, title, onBack,
}: {
  optionType: OptionType; title: string; onBack: () => void;
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
      <DialogHeader>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onBack} className="rounded-md p-1 hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </button>
          <DialogTitle>{title}</DialogTitle>
        </div>
      </DialogHeader>

      <div className="flex gap-2 mt-1">
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

      <div className="space-y-0.5 max-h-64 overflow-y-auto mt-1">
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

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onBack}>← Back to Brief</Button>
      </DialogFooter>
    </>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

export function NewBriefDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const { settings } = useSettings();
  const [view, setView] = useState<View>("form");

  const [client, setClient] = useState("");
  const [adType, setAdType] = useState<"image_ads" | "video_ads">("image_ads");
  const [template, setTemplate] = useState("");
  const [angle, setAngle] = useState("");
  const [offer, setOffer] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    onOpenChange(false);
    setView("form");
    setClient(""); setAdType("image_ads"); setTemplate("");
    setAngle(""); setOffer(""); setAssignedTo(""); setNotes(""); setSaving(false);
  };

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-for-brief"],
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts").select("id, account_name").order("account_name");
      if (error) throw error;
      return data as { id: string; account_name: string }[];
    },
  });

  const visibleAccounts = accounts.filter(
    (a) => !settings.hidden_accounts.includes(a.account_name)
  );

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-by-adtype", adType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creatives").select("batch_name")
        .eq("file_type", "template_type").eq("file_name", adType === "image_ads" ? "image" : "video");
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.batch_name).filter(Boolean) as string[])].sort();
    },
    enabled: open,
  });

  const { data: adAngles = [] } = useQuery({
    queryKey: ["creative-options", "ad_angle"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creative_options").select("value").eq("type", "ad_angle").order("value");
      if (error) throw error;
      return (data ?? []).map((r) => r.value);
    },
    enabled: open,
  });

  const { data: offerTypes = [] } = useQuery({
    queryKey: ["creative-options", "offer_type"],
    queryFn: async () => {
      const { data, error } = await supabase.from("creative_options").select("value").eq("type", "offer_type").order("value");
      if (error) throw error;
      return (data ?? []).map((r) => r.value);
    },
    enabled: open,
  });

  const addOption = async (type: OptionType, value: string) => {
    const { error } = await supabase.from("creative_options").insert({ type, value });
    if (!error) queryClient.invalidateQueries({ queryKey: ["creative-options", type] });
  };

  const canCreate = !!client && !!template && !!angle && !!offer;

  const createBrief = useMutation({
    mutationFn: async () => {
      setSaving(true);
      const { data, error } = await supabase.from("creative_requests").insert({
        account_name: client, ad_type: adType, template_name: template,
        ad_angle: angle, offer_type: offer,
        notes: notes.trim() || null, assigned_to: assignedTo.trim() || null, status: "assigned",
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-creative-requests"] });
      reset();
      toast.success("Creative brief created");
    },
    onError: (err: Error) => { setSaving(false); toast.error(err.message); },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); }}>
      <DialogContent className="max-w-lg">

        {/* ── Manage view ──────────────────────────────────────────────────── */}
        {view === "manage_angle" && (
          <ManagePanel optionType="ad_angle" title="Manage Ad Angles" onBack={() => setView("form")} />
        )}
        {view === "manage_offer" && (
          <ManagePanel optionType="offer_type" title="Manage Offer Types" onBack={() => setView("form")} />
        )}

        {/* ── Form view ────────────────────────────────────────────────────── */}
        {view === "form" && (
          <>
            <DialogHeader>
              <DialogTitle>New Creative Brief</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Client */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Client</label>
                <Select value={client} onValueChange={setClient}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {visibleAccounts.map((a) => <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Ad Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Ad Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["image_ads", "Image Ads", <ImageIcon className="h-3.5 w-3.5" />] as const,
                    ["video_ads", "Video Ads", <Film className="h-3.5 w-3.5" />] as const,
                  ]).map(([val, label, icon]) => (
                    <button key={val} type="button" onClick={() => { setAdType(val); setTemplate(""); }}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all",
                        adType === val
                          ? val === "image_ads" ? "bg-sky-50 text-sky-700 border-sky-300 shadow-sm" : "bg-violet-50 text-violet-700 border-violet-300 shadow-sm"
                          : "border-border text-muted-foreground hover:bg-muted/40 hover:border-muted-foreground/40"
                      )}>
                      {icon}{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Template</label>
                <Combobox
                  value={template} onChange={setTemplate} options={templates}
                  placeholder="Select a template…" searchPlaceholder="Search templates…"
                  emptyText={`No ${adType === "image_ads" ? "image" : "video"} templates in library`}
                />
                {templates.length === 0 && (
                  <p className="text-[11px] text-amber-600">Set template types in the Template Library first.</p>
                )}
              </div>

              {/* Ad Angle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Ad Angle</label>
                  <button type="button" onClick={() => setView("manage_angle")}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    <Settings2 className="h-3 w-3" /> Manage
                  </button>
                </div>
                <Combobox
                  value={angle} onChange={setAngle} options={adAngles}
                  placeholder="Select or add an angle…" searchPlaceholder="Search or add…"
                  emptyText="Type to add a new angle"
                  onAddNew={(v) => addOption("ad_angle", v)}
                />
              </div>

              {/* Offer Type */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Offer Type</label>
                  <button type="button" onClick={() => setView("manage_offer")}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    <Settings2 className="h-3 w-3" /> Manage
                  </button>
                </div>
                <Combobox
                  value={offer} onChange={setOffer} options={offerTypes}
                  placeholder="Select or add an offer type…" searchPlaceholder="Search or add…"
                  emptyText="Type to add a new offer type"
                  onAddNew={(v) => addOption("offer_type", v)}
                />
              </div>

              {/* Assign To + Notes */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Assign To <span className="text-muted-foreground/50">(optional)</span></label>
                  <AssigneeSelect value={assignedTo} onChange={setAssignedTo} className="h-9 w-full" placeholder="Unassigned" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Notes <span className="text-muted-foreground/50">(optional)</span></label>
                  <Input placeholder="Any context…" value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9 text-sm" />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <Button onClick={() => createBrief.mutate()} disabled={!canCreate || saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                {saving ? "Creating…" : "Create Brief"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
