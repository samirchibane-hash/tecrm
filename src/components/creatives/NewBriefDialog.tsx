import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/hooks/useSettings";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import { Combobox, ManagePanel } from "./creativeOptionControls";
import { useAddCreativeOption } from "./creativeOptions";
import { Image as ImageIcon, Film, ClipboardList, Loader2, Settings2 } from "lucide-react";

type View = "form" | "manage_angle" | "manage_offer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preconfigure the brief when launched from a Template Library cell. */
  defaultClient?: string;
  defaultTemplate?: string;
  defaultAdType?: "image_ads" | "video_ads";
}

// ── Main Sheet ────────────────────────────────────────────────────────────────

export function NewBriefDialog({ open, onOpenChange, defaultClient, defaultTemplate, defaultAdType }: Props) {
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

  // When opened from a Template Library cell, seed the client/template/type so the
  // operator only has to fill in the angle and offer. Runs once per open.
  useEffect(() => {
    if (!open) return;
    setView("form");
    if (defaultAdType !== undefined) setAdType(defaultAdType);
    if (defaultClient !== undefined) setClient(defaultClient);
    if (defaultTemplate !== undefined) setTemplate(defaultTemplate);
  }, [open, defaultClient, defaultTemplate, defaultAdType]);

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

  const addOption = useAddCreativeOption();

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
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden">

        {/* ── Manage view ──────────────────────────────────────────────────── */}
        {view === "manage_angle" && (
          <ManagePanel optionType="ad_angle" title="Manage Ad Angles" onBack={() => setView("form")} backLabel="← Back to Brief" />
        )}
        {view === "manage_offer" && (
          <ManagePanel optionType="offer_type" title="Manage Offer Types" onBack={() => setView("form")} backLabel="← Back to Brief" />
        )}

        {/* ── Form view ────────────────────────────────────────────────────── */}
        {view === "form" && (
          <>
            <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <SheetTitle className="text-base font-semibold">New Creative Brief</SheetTitle>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
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

            <div className="border-t border-border px-6 py-4 flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <Button onClick={() => createBrief.mutate()} disabled={!canCreate || saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                {saving ? "Creating…" : "Create Brief"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
