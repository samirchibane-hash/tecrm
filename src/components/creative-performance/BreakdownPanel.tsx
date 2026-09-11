import { useMemo, useState } from "react";
import { Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCount, formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Dash, VerdictPill } from "./CreativeBits";
import { breakdown, DIMENSIONS, type BreakdownContext, type Dimension, type GroupRow } from "./breakdowns";
import { METRIC_NOUN, type Benchmark } from "./verdicts";
import type { CreativeAd } from "./useCreativePerformance";

const INTRO: Record<Dimension, string> = {
  offer: "Which offer buys results cheapest. Offers are read from each ad's copy and name; correct any ad from All creatives.",
  angle: "Which hook works: the problem the ad opens on. Correct any ad's angle from All creatives.",
  headline: "Every headline across the account. Ads that rotate several are split per headline with Meta's asset breakdown.",
  body: "Every primary text across the account. Ads that rotate several are split per text with Meta's asset breakdown.",
  format: "Video against image.",
  adset: "Each ad set's creatives combined.",
  landing_page: "Where the click goes. The Funnel tab tests the pages themselves (views → leads).",
};

/** A single-hue share bar: magnitude only, so one color (dataviz: sequential). */
function ShareBar({ share }: { share: number }) {
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full" style={{ width: `${Math.max(2, share * 100)}%`, background: "hsl(var(--chart-1))" }} />
    </div>
  );
}

/** Offer / angle / headline / primary text / format / ad set / landing page, each group judged like an ad. */
export function BreakdownPanel({
  ads,
  ctx,
  benchmark,
  trackingGap,
  appointmentsTracked,
}: {
  ads: CreativeAd[];
  ctx: BreakdownContext;
  benchmark: Benchmark | null;
  trackingGap: boolean;
  appointmentsTracked: boolean;
}) {
  const isMobile = useIsMobile();
  const [dim, setDim] = useState<Dimension>("offer");
  const rows = useMemo(() => breakdown(dim, ads, ctx, benchmark, trackingGap), [dim, ads, ctx, benchmark, trackingGap]);
  const noun = METRIC_NOUN[ctx.metric];
  const showAppts = appointmentsTracked && ctx.metric === "leads";
  const anyAssets = rows.some((r) => r.fromAssets);
  const isText = dim === "headline" || dim === "body";
  const dimLabel = DIMENSIONS.find((d) => d.value === dim)?.label.toLowerCase() ?? dim;
  const onlyOne = rows.filter((r) => !r.catchAll).length === 1;

  const label = (r: GroupRow) => (
    <div className="min-w-0">
      <p
        className={cn("text-sm text-foreground", isText ? "line-clamp-2 whitespace-pre-line" : "truncate font-medium", r.catchAll && "italic text-muted-foreground")}
        title={r.label}
      >
        {r.label}
      </p>
      <p className="text-[11px] text-muted-foreground">
        {r.adIds.length} {r.adIds.length === 1 ? "ad" : "ads"}
        {r.fromAssets && <> · split by Meta</>}
      </p>
    </div>
  );
  const cost = (r: GroupRow) => (r.costPer !== null ? formatUsd(r.costPer, { decimals: true }) : <Dash title={`No ${noun.many} in this period`} />);

  return (
    <section className="space-y-3" aria-labelledby="breakdown-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="breakdown-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />
          What's working
        </h3>
        {isMobile ? (
          <Select value={dim} onValueChange={(v) => setDim(v as Dimension)}>
            <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Break down by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIMENSIONS.map((d) => <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <SegmentedControl value={dim} onChange={setDim} options={DIMENSIONS} label="Break down by" />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {INTRO[dim]}
        {onlyOne && (
          <span className="text-foreground"> Every ad in this period shares one {dimLabel}, so there's nothing to compare yet: test a second one against it.</span>
        )}
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No spend in this period to break down.
        </p>
      ) : isMobile ? (
        <ul className="divide-y divide-border/60 rounded-md border border-border/50">
          {rows.map((r) => (
            <li key={r.key} className="space-y-1.5 p-3">
              <div className="flex items-start justify-between gap-2">
                {label(r)}
                <VerdictPill verdict={r.verdict} reason={r.reason} group className="shrink-0" />
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Spend</dt>
                  <dd className="font-medium tabular-nums text-foreground">{formatUsd(r.spend)}</dd>
                </div>
                <div>
                  <dt className="capitalize text-muted-foreground">{noun.many}</dt>
                  <dd className="font-medium tabular-nums text-foreground">{formatCount(r.results)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{noun.costLabel}</dt>
                  <dd className="font-medium tabular-nums text-foreground">{cost(r)}</dd>
                </div>
              </dl>
              <ShareBar share={r.share} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-auto rounded-md border border-border/50">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{DIMENSIONS.find((d) => d.value === dim)?.label}</TableHead>
                <TableHead className="w-[150px] text-right">Spend · share</TableHead>
                <TableHead className="text-right capitalize">{noun.many}</TableHead>
                <TableHead className="text-right">{noun.costLabel}</TableHead>
                {showAppts && <TableHead className="text-right">Appts</TableHead>}
                <TableHead className="text-right">Link CTR</TableHead>
                <TableHead>Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className={cn("py-2", isText ? "min-w-[260px] max-w-[440px]" : "min-w-[180px] max-w-[320px]")}>{label(r)}</TableCell>
                  <TableCell className="py-2 text-right tabular-nums">
                    {formatUsd(r.spend)}
                    <span className="ml-1 text-[11px] text-muted-foreground">{Math.round(r.share * 100)}%</span>
                    <ShareBar share={r.share} />
                  </TableCell>
                  <TableCell className="py-2 text-right tabular-nums">{formatCount(r.results)}</TableCell>
                  <TableCell className="py-2 text-right tabular-nums">{cost(r)}</TableCell>
                  {showAppts && (
                    <TableCell className="py-2 text-right tabular-nums">
                      {r.appointments !== null ? formatCount(r.appointments) : <Dash title="Not tracked" />}
                    </TableCell>
                  )}
                  <TableCell className="py-2 text-right tabular-nums">
                    {r.ctr !== null ? formatPercent(r.ctr) : <Dash title="No impressions" />}
                  </TableCell>
                  <TableCell className="py-2">
                    <VerdictPill verdict={r.verdict} reason={r.reason} group />
                    <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-muted-foreground" title={r.reason}>{r.reason}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {isText && anyAssets && (
        <p className="text-[11px] text-muted-foreground">
          "Split by Meta" rows come from Meta's asset breakdown, which Meta models per text; its totals can differ from the ad's by a few cents.
        </p>
      )}
    </section>
  );
}
