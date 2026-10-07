import { ExternalLink, FlaskConical, PenLine } from "lucide-react";
import { formatCount, formatUsd } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { Dash } from "@/components/creative-performance/CreativeBits";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { FunnelRow } from "./funnelRows";
import { SplitTestPanel } from "./SplitTestPanel";
import { historyEvents, shortDate } from "./funnelDisplay";

const SHEET = "flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg";

function SheetTop({ title, row, caption }: { title: string; row: FunnelRow; caption?: string }) {
  return (
    <SheetHeader className="space-y-1 border-b border-border/60 px-5 py-4 text-left">
      <SheetTitle className="text-base">{title}</SheetTitle>
      <SheetDescription className="text-xs">
        {row.label} · {row.accountName}
        {caption && <> · {caption}</>}
      </SheetDescription>
    </SheetHeader>
  );
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/** The ads sending this page traffic, dearest first, with the page's Meta totals on top. */
export function AdsSheet({
  row,
  open,
  onOpenChange,
  periodCaption,
}: {
  row: FunnelRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodCaption?: string;
}) {
  const perf = row.perf;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={SHEET}>
        <SheetTop title="Ads driving traffic" row={row} caption={periodCaption} />

        {perf && (
          <dl className="grid grid-cols-4 gap-3 border-b border-border/60 px-5 py-3">
            <Figure label="Spend" value={formatUsd(perf.spend)} />
            <Figure label="Link clicks" value={formatCount(perf.linkClicks)} />
            <Figure label="Page views" value={formatCount(perf.lpv)} />
            <Figure
              label="Cost / lead"
              value={perf.costPer !== null ? formatUsd(perf.costPer) : <Dash title="No leads yet, so no cost per lead" />}
            />
          </dl>
        )}

        {row.ads.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No ad sent traffic to this page in this period.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {row.ads.map((ad) => (
              <li key={ad.id} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" title={ad.name}>{ad.name}</p>
                  <p className="truncate text-xs text-muted-foreground" title={ad.adset ?? undefined}>
                    {ad.adset ?? "Ad set unknown"}
                  </p>
                </div>
                <StatusPill status={ad.live ? "success" : "neutral"}>{ad.live ? "Active" : "Off"}</StatusPill>
                <div className="w-20 shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">{formatUsd(ad.spend)}</p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">{formatCount(ad.lpv)} views</p>
                </div>
                {ad.adsManagerUrl ? (
                  <a
                    href={ad.adsManagerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Open ${ad.name} in Meta Ads Manager`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                ) : (
                  <span className="w-[22px] shrink-0" aria-hidden />
                )}
              </li>
            ))}
          </ul>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function HistorySheet({
  row,
  open,
  onOpenChange,
}: {
  row: FunnelRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const events = historyEvents(row);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={SHEET}>
        <SheetTop title="Funnel history" row={row} />
        {events.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            Nothing recorded yet: no split test has run and the copy hasn&rsquo;t changed since version tracking started.
          </p>
        ) : (
          <ol className="relative px-5 py-4">
            {/* The rail the events hang off. */}
            <span className="absolute bottom-4 left-[29px] top-4 w-px bg-border" aria-hidden />
            {events.map((e) => (
              <li key={e.key} className="relative flex gap-3 pb-4 last:pb-0">
                <span className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-card">
                  {e.kind === "test"
                    ? <FlaskConical className="h-3 w-3 text-muted-foreground" aria-hidden />
                    : <PenLine className="h-3 w-3 text-muted-foreground" aria-hidden />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{shortDate(e.at)}</p>
                  {e.kind === "test" ? (
                    <div className="mt-1"><SplitTestPanel test={e.test} compact /></div>
                  ) : (
                    <>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
                        Copy v{e.version.version}
                        {e.version.variant !== "a" && ` · arm ${e.version.variant.toUpperCase()}`}
                        <StatusPill status={e.version.live ? "success" : "neutral"}>
                          {e.version.live ? "Live" : `Until ${e.version.to ? shortDate(e.version.to) : "—"}`}
                        </StatusPill>
                      </p>
                      <p className="mt-0.5 text-xs text-foreground/80" title={e.version.headline ?? undefined}>
                        {e.version.headline ? `“${e.version.headline}”` : "Copy not recorded"}
                      </p>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </SheetContent>
    </Sheet>
  );
}
