import { useMemo, useState, type ReactNode } from "react";
import { format, formatDistanceToNowStrict, parseISO } from "date-fns";
import { ArrowDown, ArrowUp, ArrowUpDown, DollarSign, Film, Image as ImageIcon, Megaphone, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCount, formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CREATIVE_PERIODS,
  useCreativePerformance,
  type CreativePeriod,
  type LiveAd,
} from "./useCreativePerformance";
import { sortCreatives, summarizeCreatives, type CreativeSortKey } from "./summarize";

const RESULT_TILES = 2; // beyond this, extra result types still show per row

const SORT_LABELS: Record<CreativeSortKey, string> = {
  spend: "Spend",
  results: "Results",
  costPer: "Cost / result",
  linkCtr: "Link CTR",
};

// Cheapest cost per result first; everything else biggest first.
const defaultDir = (key: CreativeSortKey) => (key === "costPer" ? "asc" : "desc");

function periodText(since: string, until: string) {
  const a = parseISO(since);
  const b = parseISO(until);
  return a.getFullYear() === b.getFullYear()
    ? `${format(a, "MMM d")} – ${format(b, "MMM d, yyyy")}`
    : `${format(a, "MMM d, yyyy")} – ${format(b, "MMM d, yyyy")}`;
}

function Thumbnail({ ad }: { ad: LiveAd }) {
  const [broken, setBroken] = useState(false);
  const FormatIcon = ad.format === "video" ? Film : ImageIcon;
  return (
    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted">
      {ad.thumbnailUrl && !broken ? (
        <img src={ad.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <FormatIcon className="absolute inset-0 m-auto h-5 w-5 text-muted-foreground/40" aria-hidden />
      )}
      {ad.format === "video" && ad.thumbnailUrl && !broken && (
        <span className="absolute bottom-0.5 right-0.5 rounded bg-background/85 p-0.5">
          <Film className="h-2.5 w-2.5 text-foreground" aria-hidden />
        </span>
      )}
    </div>
  );
}

const Dash = ({ title }: { title: string }) => (
  <span className="text-muted-foreground" title={title}>—</span>
);

function CreativeName({ ad }: { ad: LiveAd }) {
  return (
    <div className="min-w-0">
      <a
        href={ad.adsManagerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block truncate font-medium text-foreground hover:underline"
        title={`${ad.name} (open in Ads Manager)`}
      >
        {ad.name}
      </a>
      <p className="truncate text-xs text-muted-foreground" title={ad.adset ?? undefined}>
        {ad.format === "video" ? "Video" : "Image"}
        {ad.adset && <> · {ad.adset}</>}
      </p>
    </div>
  );
}

function resultCount(ad: LiveAd): ReactNode {
  if (!ad.result) return <Dash title={`Meta reports no result for this ad's goal (${ad.optimizationGoal ?? "unknown"})`} />;
  return (
    <span className="tabular-nums">
      {formatCount(ad.result.count)}
      {ad.result.source === "actions" && <span className="text-muted-foreground">*</span>}
    </span>
  );
}

function costPerResult(ad: LiveAd): ReactNode {
  return ad.result?.costPer != null ? formatUsd(ad.result.costPer, { decimals: true }) : <Dash title="No results in this period" />;
}

/**
 * Every ad live in the client's Meta account right now, with spend and Meta's own
 * Results / Cost per result for the chosen period. Read live from the Graph API
 * through the meta-creative-performance edge function; nothing is stored.
 */
export function CreativePerformanceCard({ accountId }: { accountId: string }) {
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState<CreativePeriod>("last_30d");
  const [sort, setSort] = useState<{ key: CreativeSortKey; dir: "asc" | "desc" }>({ key: "spend", dir: "desc" });
  const { data, isLoading, isError, error, refetch, isFetching } = useCreativePerformance(accountId, period);

  const summary = useMemo(() => summarizeCreatives(data?.ads ?? []), [data]);
  const rows = useMemo(() => sortCreatives(data?.ads ?? [], sort.key, sort.dir), [data, sort]);
  const periodLabel = CREATIVE_PERIODS.find((p) => p.value === period)?.label ?? period;
  const usesActionCounts = rows.some((ad) => ad.result?.source === "actions");

  const toggleSort = (key: CreativeSortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: defaultDir(key) }));

  const sortHead = (k: CreativeSortKey, className?: string) => {
    const active = sort.key === k;
    const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <TableHead className={cn("text-right", className)} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SORT_LABELS[k]}
          <Icon className={cn("h-3 w-3", !active && "opacity-40")} aria-hidden />
        </button>
      </TableHead>
    );
  };

  const caption = data?.adAccount
    ? [
        `Meta Ads · ${data.adAccount.name}`,
        data.period ? periodText(data.period.since, data.period.until) : periodLabel,
        `updated ${formatDistanceToNowStrict(new Date(data.fetchedAt), { addSuffix: true })}`,
      ].join(" · ")
    : `Meta Ads · ${periodLabel}`;

  const spendShare = data?.accountSpend ? Math.round((summary.spend / data.accountSpend) * 100) : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Live creative performance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as CreativePeriod)}>
            <SelectTrigger className="h-8 w-[132px] text-xs" aria-label="Report period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CREATIVE_PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isMobile && (
            <Select value={sort.key} onValueChange={(v) => setSort({ key: v as CreativeSortKey, dir: defaultDir(v as CreativeSortKey) })}>
              <SelectTrigger className="h-8 w-[132px] text-xs" aria-label="Sort by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["spend", "results", "costPer"] as const).map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">{SORT_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh from Meta"
            title="Refresh from Meta"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {isLoading || !accountId ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)}
          </div>
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}
        </div>
      ) : isError ? (
        <SourceUnavailableNotice source="Meta Ads" message={(error as Error).message} onRetry={() => refetch()} retrying={isFetching} />
      ) : !data?.adAccount ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          This client has no Meta ad account on file, so there are no creatives to report.
        </p>
      ) : data.ads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No ads are live in {data.adAccount.name} right now.
          {!!data.accountSpend && <> Paused ads spent {formatUsd(data.accountSpend, { decimals: true })} in this period.</>}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiStatCard
              label="Live ads"
              value={formatCount(summary.live)}
              icon={Megaphone}
              detail={`${summary.delivered} delivered in period`}
            />
            <KpiStatCard
              label="Spend · live ads"
              value={formatUsd(summary.spend)}
              icon={DollarSign}
              detail={spendShare !== null ? `${spendShare}% of account spend` : undefined}
            />
            {summary.results.length === 0 ? (
              <KpiStatCard label="Results" value="—" icon={Target} unavailable unavailableReason="Meta reports no result for these ads' goals" />
            ) : (
              summary.results.slice(0, RESULT_TILES).map((r) => (
                <KpiStatCard
                  key={r.type}
                  label={r.label}
                  value={formatCount(r.count)}
                  icon={Target}
                  detail={r.costPer !== null ? `${formatUsd(r.costPer, { decimals: true })} per result` : "No results in period"}
                />
              ))
            )}
          </div>

          {isMobile ? (
            <ul className="divide-y divide-border/60 rounded-md border border-border/50">
              {rows.map((ad) => (
                <li key={ad.id} className="flex gap-3 p-3">
                  <Thumbnail ad={ad} />
                  <div className="min-w-0 flex-1 text-sm">
                    <CreativeName ad={ad} />
                    {ad.delivered ? (
                      <dl className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-muted-foreground">Spend</dt>
                          <dd className="font-medium tabular-nums text-foreground">{formatUsd(ad.spend, { decimals: true })}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="truncate text-muted-foreground">{ad.result?.label ?? "Results"}</dt>
                          <dd className="font-medium text-foreground">{resultCount(ad)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Cost / result</dt>
                          <dd className="font-medium tabular-nums text-foreground">{costPerResult(ad)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No delivery in this period</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="overflow-auto rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Creative</TableHead>
                    {sortHead("spend")}
                    {sortHead("results")}
                    {sortHead("costPer")}
                    {sortHead("linkCtr")}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((ad) => (
                    <TableRow key={ad.id}>
                      <TableCell className="min-w-[220px] max-w-[360px] py-2">
                        <div className="flex items-center gap-3">
                          <Thumbnail ad={ad} />
                          <CreativeName ad={ad} />
                        </div>
                      </TableCell>
                      {ad.delivered ? (
                        <>
                          <TableCell className="py-2 text-right tabular-nums">{formatUsd(ad.spend, { decimals: true })}</TableCell>
                          <TableCell className="py-2 text-right">
                            {resultCount(ad)}
                            {ad.result && <span className="block text-[11px] text-muted-foreground">{ad.result.label}</span>}
                          </TableCell>
                          <TableCell className="py-2 text-right tabular-nums">{costPerResult(ad)}</TableCell>
                          <TableCell className="py-2 text-right tabular-nums">
                            {ad.linkCtr !== null ? formatPercent(ad.linkCtr) : <Dash title="No link clicks in this period" />}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell colSpan={4} className="py-2 text-right text-xs text-muted-foreground">
                          No delivery in this period
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Results and cost per result are Meta's own: each ad set's optimization event, counted with the ad account's
            attribution setting. Only compare cost per result between ads with the same result type. Spend covers live ads only.
            {usesActionCounts && (
              <> * Meta leaves Results empty for instant-form ads, so these count form leads from Meta's action data.</>
            )}
          </p>
        </>
      )}
    </section>
  );
}
