import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Combobox, ManagePanel } from "./creativeOptionControls";
import { useAddCreativeOption } from "./creativeOptions";
import { TEMPLATE_PRODUCTION_ACCOUNT } from "./types";
import { Image as ImageIcon, Film, Loader2, Settings2, Camera, X, Plus } from "lucide-react";

type View = "form" | "manage_angle" | "manage_offer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTemplateSheet({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const addOption = useAddCreativeOption();
  const [view, setView] = useState<View>("form");

  const [name, setName] = useState("");
  const [type, setType] = useState<"image" | "video" | null>(null);
  const [videoPart, setVideoPart] = useState<"hook" | "body" | null>(null);
  const [link, setLink] = useState("");
  const [angle, setAngle] = useState("");
  const [offer, setOffer] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    onOpenChange(false);
    setView("form");
    setName(""); setType(null); setVideoPart(null); setLink(""); setAngle(""); setOffer("");
    setNotes(""); setFile(null); setPreview(null); setSaving(false);
  };

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

  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!name.trim()) return;
      setSaving(true);
      // The template's meta row carries its type, master link, and default
      // production metadata (ad angle / offer type / notes).
      const { error } = await supabase.from("creatives").insert({
        account_name: "_meta",
        batch_name: name.trim(),
        file_name: type ?? "",
        file_url: link.trim(),
        file_type: "template_type",
        video_part: type === "video" ? videoPart : null,
        ad_angle: angle.trim() || null,
        offer_type: offer.trim() || null,
        notes: notes.trim() || null,
        launch_date: null,
      });
      if (error) throw error;

      // The template has to be produced before it's official and duplicatable
      // for clients, so open a production request that flows through the same
      // Assigned → Reviewing → Approved → Launched pipeline as a client brief.
      const { error: reqError } = await supabase.from("creative_requests").insert({
        account_name: TEMPLATE_PRODUCTION_ACCOUNT,
        ad_type: type === "video" ? "video_ads" : "image_ads",
        template_name: name.trim(),
        ad_angle: angle.trim(),
        offer_type: offer.trim(),
        notes: notes.trim() || null,
        status: "assigned",
        is_template: true,
      });
      if (reqError) throw reqError;

      if (file) {
        const ext = file.name.split(".").pop();
        const path = `_meta/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("creatives").upload(path, file);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage.from("creatives").getPublicUrl(path);
        await supabase.from("creatives").insert({
          account_name: "_meta",
          batch_name: name.trim(),
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: "image",
          launch_date: null,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creatives"] });
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-creative-requests"] });
      reset();
      toast.success("Template created — sent to production");
    },
    onError: (err: Error) => { setSaving(false); toast.error(`Failed: ${err.message}`); },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); }}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col overflow-hidden">

        {/* ── Manage views ─────────────────────────────────────────────────── */}
        {view === "manage_angle" && (
          <ManagePanel optionType="ad_angle" title="Manage Ad Angles" onBack={() => setView("form")} backLabel="← Back to Template" />
        )}
        {view === "manage_offer" && (
          <ManagePanel optionType="offer_type" title="Manage Offer Types" onBack={() => setView("form")} backLabel="← Back to Template" />
        )}

        {/* ── Form view ────────────────────────────────────────────────────── */}
        {view === "form" && (
          <>
            <div className="px-6 pt-6 pb-4 border-b border-border shrink-0">
              <SheetTitle className="text-base font-semibold">New Template</SheetTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Define a template and its default production details.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {/* Template Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Template Name <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g. IMG001, VSL-Hero, Static-Square"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 text-sm"
                  autoFocus
                />
              </div>

              {/* Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Type <span className="text-muted-foreground/50">(optional)</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {(["image", "video"] as const).map((t) => (
                    <button key={t} type="button"
                      onClick={() => { const next = type === t ? null : t; setType(next); if (next !== "video") setVideoPart(null); }}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-xs font-semibold transition-all",
                        type === t
                          ? t === "video" ? "bg-violet-50 text-violet-700 border-violet-300 shadow-sm" : "bg-sky-50 text-sky-700 border-sky-300 shadow-sm"
                          : "border-border text-muted-foreground hover:bg-muted/40 hover:border-muted-foreground/40"
                      )}>
                      {t === "video" ? <Film className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                      {t === "video" ? "Video" : "Image"}
                    </button>
                  ))}
                </div>

                {/* Video templates are a Hook or a Body of the ad */}
                {type === "video" && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {(["hook", "body"] as const).map((p) => (
                      <button key={p} type="button" onClick={() => setVideoPart(videoPart === p ? null : p)}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-semibold transition-all",
                          videoPart === p
                            ? "bg-violet-100 text-violet-800 border-violet-300 shadow-sm"
                            : "border-border text-muted-foreground hover:bg-muted/40 hover:border-muted-foreground/40"
                        )}>
                        {p === "hook" ? "Hook" : "Body"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Master Template Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Master Template Link <span className="text-muted-foreground/50">(optional)</span></label>
                <Input
                  placeholder="https://drive.google.com/…"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

              {/* Ad Angle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-muted-foreground">Ad Angle <span className="text-muted-foreground/50">(optional)</span></label>
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
                  <label className="text-xs font-medium text-muted-foreground">Offer Type <span className="text-muted-foreground/50">(optional)</span></label>
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

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Notes <span className="text-muted-foreground/50">(optional)</span></label>
                <Textarea
                  placeholder="Production notes, hooks, do's and don'ts…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm min-h-[76px] resize-y"
                />
              </div>

              {/* Thumbnail */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Thumbnail <span className="text-muted-foreground/50">(optional)</span></label>
                <div className="relative rounded-xl border-2 border-dashed border-border p-4 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setFile(f);
                      setPreview(URL.createObjectURL(f));
                    }}
                  />
                  {preview ? (
                    <div className="relative inline-block">
                      <img src={preview} alt="Preview" className="max-h-32 rounded-lg mx-auto" />
                      <button
                        className="absolute -top-1 -right-1 bg-background rounded-full border border-border p-0.5"
                        onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1.5 py-2">
                      <Camera className="h-5 w-5 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">Click to upload a thumbnail</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-border px-6 py-4 flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={reset}>Cancel</Button>
              <Button onClick={() => saveTemplate.mutate()} disabled={!name.trim() || saving} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving ? "Creating…" : "Create Template"}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
