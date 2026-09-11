import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Crosshair, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatUsd } from "@/lib/format";

const parse = (v: string): number | null | "invalid" => {
  if (!v.trim()) return null;
  const n = Number(v.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : "invalid";
};

/**
 * This client's cost targets (design rule #6): what "good" costs for their
 * economics. Creative verdicts and the dashboard's CPL / CPA coloring read these.
 */
export function AccountTargetsPopover({
  accountId,
  accountName,
  cpl,
  cpa,
}: {
  accountId: string;
  accountName: string;
  cpl: number | null;
  cpa: number | null;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cplText, setCplText] = useState("");
  const [cpaText, setCpaText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCplText(cpl ? String(cpl) : "");
      setCpaText(cpa ? String(cpa) : "");
    }
  }, [open, cpl, cpa]);

  const nextCpl = parse(cplText);
  const nextCpa = parse(cpaText);
  const invalid = nextCpl === "invalid" || nextCpa === "invalid";

  async function save() {
    if (invalid || !accountId) return;
    setSaving(true);
    const { error } = await supabase.from("accounts").update({ target_cpl: nextCpl, target_cpa: nextCpa }).eq("id", accountId);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save targets");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["account", accountName] });
    queryClient.invalidateQueries({ queryKey: ["all-accounts"] });
    toast.success("Targets saved");
    setOpen(false);
  }

  const summary = [cpl ? `${formatUsd(cpl)} CPL` : null, cpa ? `${formatUsd(cpa)} per appt` : null].filter(Boolean).join(" · ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex h-8 items-center gap-1.5 rounded-md border border-border/60 bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Cost targets: ${summary || "not set"}. Edit`}
        >
          <Crosshair className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {summary ? <>Targets · <span className="tabular-nums text-foreground">{summary}</span></> : "Set targets"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Cost targets</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            What a lead and a booked appointment should cost this client. Creatives are judged against these; leave one
            blank to judge against the account's own average instead.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="target-cpl" className="mb-1 block text-xs text-muted-foreground">Cost per lead</Label>
            <Input id="target-cpl" inputMode="decimal" placeholder="$40" value={cplText} onChange={(e) => setCplText(e.target.value)} className="h-8 text-sm" />
          </div>
          <div>
            <Label htmlFor="target-cpa" className="mb-1 block text-xs text-muted-foreground">Cost per appt</Label>
            <Input id="target-cpa" inputMode="decimal" placeholder="$200" value={cpaText} onChange={(e) => setCpaText(e.target.value)} className="h-8 text-sm" />
          </div>
        </div>
        {invalid && <p className="text-xs text-danger">Targets must be positive dollar amounts.</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
          <Button size="sm" className="h-7 text-xs" disabled={invalid || saving} onClick={save}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
