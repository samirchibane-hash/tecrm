import { useState } from "react";
import { Clock3, Film, Image as ImageIcon, Minus, OctagonX, TrendingUp, CircleHelp, CirclePause } from "lucide-react";
import { StatusPill, type Status } from "@/components/StatusPill";
import { deliveryStatusText } from "./adStatus";
import { cn } from "@/lib/utils";
import type { CreativeAd } from "./useCreativePerformance";
import type { Verdict } from "./verdicts";

// Small pieces every creative surface shares (account leaderboard, action
// board, breakdowns, the cross-client board), so an ad reads the same everywhere.

/**
 * `sm` / `md` identify an ad in a dense row. `xl` is for the creative gallery,
 * where the point is to *look* at the ad, so it shows the whole frame
 * (object-contain — Meta serves a 320px thumbnail, cropping it to a square
 * would hide the headline burnt into most of these creatives).
 */
const THUMB_SIZE = {
  sm: { box: "h-10 w-10", icon: "h-5 w-5" },
  md: { box: "h-12 w-12", icon: "h-5 w-5" },
  xl: { box: "h-[200px] w-[200px]", icon: "h-10 w-10" },
} as const;

export function CreativeThumbnail({ ad, size = "md" }: { ad: Pick<CreativeAd, "thumbnailUrl" | "format">; size?: keyof typeof THUMB_SIZE }) {
  const [broken, setBroken] = useState(false);
  const FormatIcon = ad.format === "video" ? Film : ImageIcon;
  const big = size === "xl";
  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted", THUMB_SIZE[size].box)}>
      {ad.thumbnailUrl && !broken ? (
        <img
          src={ad.thumbnailUrl}
          alt=""
          loading="lazy"
          className={cn("h-full w-full", big ? "object-contain" : "object-cover")}
          onError={() => setBroken(true)}
        />
      ) : (
        <FormatIcon className={cn("absolute inset-0 m-auto text-muted-foreground/40", THUMB_SIZE[size].icon)} aria-hidden />
      )}
      {ad.format === "video" && ad.thumbnailUrl && !broken && (
        <span className={cn("absolute rounded bg-background/85", big ? "bottom-1.5 right-1.5 p-1" : "bottom-0.5 right-0.5 p-0.5")}>
          <Film className={cn("text-foreground", big ? "h-3.5 w-3.5" : "h-2.5 w-2.5")} aria-hidden />
        </span>
      )}
    </div>
  );
}

/** Ad name (links to Ads Manager) over a quiet line of format · ad set · delivery status. */
export function CreativeName({ ad, sub }: { ad: CreativeAd; sub?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <a
        href={ad.adsManagerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block truncate rounded-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={`${ad.name} (open in Ads Manager)`}
      >
        {ad.name}
      </a>
      <p className="flex min-w-0 items-center gap-1 truncate text-xs text-muted-foreground">
        {!ad.live && <CirclePause className="h-3 w-3 shrink-0" aria-hidden />}
        <span className="truncate" title={ad.adset ?? undefined}>
          {sub ?? (
            <>
              {ad.live ? (ad.format === "video" ? "Video" : "Image") : deliveryStatusText(ad.status)}
              {ad.adset && <> · {ad.adset}</>}
            </>
          )}
        </span>
      </p>
    </div>
  );
}

const VERDICT: Record<Verdict, { status: Status; label: string; icon: React.ElementType }> = {
  winner: { status: "success", label: "Winner", icon: TrendingUp },
  waster: { status: "danger", label: "Money waster", icon: OctagonX },
  on_par: { status: "neutral", label: "On par", icon: Minus },
  learning: { status: "info", label: "Too early", icon: Clock3 },
  unscored: { status: "neutral", label: "Not scored", icon: CircleHelp },
  no_delivery: { status: "neutral", label: "No delivery", icon: Minus },
};

// A group (an offer, a headline) isn't one ad to cut or scale: it's ahead or behind.
const GROUP_LABEL: Partial<Record<Verdict, string>> = { winner: "Outperforming", waster: "Underperforming" };

/** The verdict in words and an icon, never color alone (design rule #7). */
export function VerdictPill({ verdict, reason, group = false, className }: { verdict: Verdict; reason?: string; group?: boolean; className?: string }) {
  const v = { ...VERDICT[verdict], ...(group && GROUP_LABEL[verdict] ? { label: GROUP_LABEL[verdict]! } : {}) };
  const Icon = v.icon;
  return (
    <span title={reason} className={cn("inline-flex", className)}>
      <StatusPill status={v.status} className="gap-1">
        <Icon className="h-3 w-3" aria-hidden />
        {v.label}
      </StatusPill>
    </span>
  );
}

export const Dash = ({ title }: { title: string }) => (
  <span className="text-muted-foreground" title={title} aria-label={title}>—</span>
);
