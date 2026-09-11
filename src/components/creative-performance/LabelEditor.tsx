import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ANGLE_LABEL, ANGLES, OFFER_LABEL, OFFERS, labelCreative, type CreativeLabels } from "./labels";
import type { CreativeAd } from "./useCreativePerformance";

const AUTO = "__auto__";

/**
 * The offer and angle chips under an ad's name. Detected values read quiet;
 * hand-set ones carry a pencil. Editing applies to every ad with this name.
 */
export function LabelEditor({
  ad,
  labels,
  onSave,
  saving,
}: {
  ad: CreativeAd;
  labels: CreativeLabels;
  onSave: (offer: string | null, angle: string | null) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const detected = labelCreative(ad);
  const [offer, setOffer] = useState<string>(labels.offerSource === "manual" ? labels.offer : AUTO);
  const [angle, setAngle] = useState<string>(labels.angleSource === "manual" ? labels.angle : AUTO);

  const chip = (text: string, manual: boolean) => (
    <span
      className={cn(
        "inline-flex max-w-[140px] items-center gap-1 truncate rounded border px-1.5 py-px text-[10px] leading-4",
        manual ? "border-border bg-muted text-foreground" : "border-border/60 text-muted-foreground",
      )}
    >
      {manual && <Pencil className="h-2.5 w-2.5 shrink-0" aria-hidden />}
      <span className="truncate">{text}</span>
    </span>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setOffer(labels.offerSource === "manual" ? labels.offer : AUTO);
          setAngle(labels.angleSource === "manual" ? labels.angle : AUTO);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="mt-1 flex flex-wrap gap-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Offer ${OFFER_LABEL[labels.offer]}, angle ${ANGLE_LABEL[labels.angle]}. Edit labels for ${ad.name}`}
        >
          {chip(OFFER_LABEL[labels.offer], labels.offerSource === "manual")}
          {chip(ANGLE_LABEL[labels.angle], labels.angleSource === "manual")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Label this creative</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Applies to every ad named “{ad.name}” in this account.</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Offer</Label>
          <Select value={offer} onValueChange={setOffer}>
            <SelectTrigger className="h-8 text-xs" aria-label="Offer"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO} className="text-xs">Detected: {OFFER_LABEL[detected.offer]}</SelectItem>
              {OFFERS.map((o) => <SelectItem key={o.key} value={o.key} className="text-xs">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Angle</Label>
          <Select value={angle} onValueChange={setAngle}>
            <SelectTrigger className="h-8 text-xs" aria-label="Angle"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO} className="text-xs">Detected: {ANGLE_LABEL[detected.angle]}</SelectItem>
              {ANGLES.map((a) => <SelectItem key={a.key} value={a.key} className="text-xs">{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={saving}
            onClick={() => {
              onSave(offer === AUTO ? null : offer, angle === AUTO ? null : angle);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
