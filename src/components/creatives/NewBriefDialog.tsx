import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Image as ImageIcon, Film, ClipboardList, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewBriefDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();

  const [client, setClient] = useState("");
  const [adType, setAdType] = useState<"image_ads" | "video_ads">("image_ads");
  const [template, setTemplate] = useState("");
  const [angle, setAngle] = useState("");
  const [offer, setOffer] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [createdBy, setCreatedBy] = useState(() => localStorage.getItem("te_username") ?? "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    onOpenChange(false);
    setClient("");
    setAdType("image_ads");
    setTemplate("");
    setAngle("");
    setOffer("");
    setAssignedTo("");
    setNotes("");
    setSaving(false);
  };

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-for-brief"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, account_name")
        .order("account_name");
      if (error) throw error;
      return data as { id: string; account_name: string }[];
    },
  });

  const { data: existingTemplates = [] } = useQuery({
    queryKey: ["template-names-for-brief"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("creatives")
        .select("batch_name")
        .not("batch_name", "is", null);
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.batch_name).filter(Boolean))] as string[];
    },
  });

  const canCreate = !!client && !!template.trim() && !!angle.trim() && !!offer.trim();

  const createBrief = useMutation({
    mutationFn: async () => {
      setSaving(true);
      const { data, error } = await supabase
        .from("creative_requests")
        .insert({
          account_name: client,
          ad_type: adType,
          template_name: template.trim(),
          ad_angle: angle.trim(),
          offer_type: offer.trim(),
          notes: notes.trim() || null,
          assigned_to: assignedTo.trim() || null,
          created_by: createdBy.trim() || null,
          status: "requested",
        })
        .select()
        .single();
      if (error) throw error;
      if (createdBy.trim()) localStorage.setItem("te_username", createdBy.trim());
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["creative-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-creative-requests"] });
      reset();
      toast.success("Creative brief created");
    },
    onError: (err: Error) => {
      setSaving(false);
      toast.error(err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New Creative Brief</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Client</label>
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.account_name}>{a.account_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Ad Type</label>
            <div className="flex gap-2">
              {([["image_ads", "Image Ads"], ["video_ads", "Video Ads"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setAdType(val)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition-colors",
                    adType === val
                      ? val === "image_ads"
                        ? "bg-sky-100 text-sky-800 border-sky-200"
                        : "bg-violet-100 text-violet-800 border-violet-200"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  {val === "image_ads" ? <ImageIcon className="h-3.5 w-3.5" /> : <Film className="h-3.5 w-3.5" />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Template</label>
            <Input
              list="new-brief-template-list"
              placeholder="Select from library or type new…"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
            <datalist id="new-brief-template-list">
              {existingTemplates.map((t) => <option key={t} value={t} />)}
            </datalist>
            <p className="text-[11px] text-muted-foreground">Start typing to see templates from your library</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Ad Angle</label>
              <Input placeholder="e.g. Pain Point" value={angle} onChange={(e) => setAngle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Offer Type</label>
              <Input placeholder="e.g. Free Estimate" value={offer} onChange={(e) => setOffer(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Assign To <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <Input placeholder="Editor name" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Created By</label>
              <Input placeholder="Your name" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Notes <span className="text-muted-foreground/50">(optional)</span>
            </label>
            <Textarea
              rows={2}
              className="resize-none text-sm"
              placeholder="Context, references, priorities…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={reset}>Cancel</Button>
          <Button onClick={() => createBrief.mutate()} disabled={!canCreate || saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            {saving ? "Creating…" : "Create Brief"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
