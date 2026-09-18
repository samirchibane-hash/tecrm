import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  FlaskConical,
  ListOrdered,
  MousePointerClick,
  OctagonX,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { SegmentedControl } from "@/components/SegmentedControl";
import { StatusPill } from "@/components/StatusPill";
import { Dash, VerdictPill } from "@/components/creative-performance/CreativeBits";
import type { Benchmark } from "@/components/creative-performance/verdicts";
import { ANGLE_LABEL, OFFER_LABEL } from "@/components/creative-performance/labels";
import { usePortfolioCreatives, type CreativeRange } from "@/components/creative-performance/useCreativePerformance";
import { useFunnelPageVersions, useFunnelRepoLinks } from "@/components/funnel-pages/useAccountLinks";
import { useAllGhlConversions } from "@/hooks/useAccountGhlConversions";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCount, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  MIN_GROUP_VIEWS,
  analyzePortfolioFunnel,
  type CopyGroup,
  type FunnelAccountInfo,
  type PortfolioGhl,
  type PortfolioPage,
  type RankedEntry,
} from "./portfolioFunnel";

const SHOWN = 8;
const GROUPS_SHOWN = 5;

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

const GROUP_STATUS: Record<CopyGroup["status"], { status: "success" | "danger" | "neutral"; label: string; help: string }> = {
  best: { status: "success", label: "Best converting", help: "The highest conversion rate of any headline or offer with enough traffic to rank" },
  behind: { status: "danger", label: "Behind", help: "Converts worse than the best one, at 95% confidence" },
  even: { status: "neutral", label: "Too close to call", help: "Not significantly different from the best one yet" },
  needs_traffic: { status: "neutral", label: "Needs traffic", help: `Fewer than ${MIN_GROUP_VIEWS} pooled page views: too few to rank` },
};

const versionDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * Which version this row is, and whether it is still serving.
 *
 * A retired version is not a lesser page — it is a finished one. Its figures
 * are final, so the badge says "Off" and the row is muted rather than hidden:
 * what the copy we just replaced actually earned is the whole comparison.
 */
function VersionBadge({ entry }: { entry: RankedEntry }) {
  if (entry.version === null) return null;

  if (entry.versionStatus === null) {
    // One version ran for the whole period; nothing to distinguish.
    return (
      <span
        className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        title={`Copy version ${entry.version}. Every figure in this row was earned by it.`}
      >
        v{entry.version}
      </span>
    );
  }

  const live = entry.versionStatus === "live";
  return (
    <span className="inline-flex items-center gap-1">
      <StatusPill status={live ? "success" : "neutral"}>
        v{entry.version} · {live ? "Live" : "Off"}
      </StatusPill>
      {entry.days !== null && (
        <span className="text-[10px] text-muted-foreground" title={`This version was live for ${entry.days} of the days in this period`}>
          {entry.days}d
        </span>
      )}
      {entry.hasSplitDay && (
        <span
          className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning"
          title="The changeover day is shared with the other version. Meta reports no finer than a day, so that day sits with whichever version held most of it."
        >
          <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
          ±1d
        </span>
      )}
    </span>
  );
}

/** The headline this row's version actually showed — not whatever is live now. */
function Headline({ entry }: { entry: RankedEntry }) {
  if (!entry.headline) {
    return (
      <p className="mt-1 text-xs italic text-muted-foreground">
        Headline not synced — register this site under Funnel Pages to read its copy
      </p>
    );
  }
  return (
    <p className="mt-1 line-clamp-2 text-xs leading-snug text-foreground/90" title={entry.page.copy ?? entry.headline}>
      “{entry.headline}”
    </p>
  );
}

function OfferTags({ page }: { page: PortfolioPage }) {
  if (!page.offer) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <StatusPill status="info">{OFFER_LABEL[page.offer]}</StatusPill>
      {page.angle && page.angle !== "none" && <StatusPill status="neutral">{ANGLE_LABEL[page.angle]}</StatusPill>}
    </div>
  );
}

/**
 * Leads the CRM holds for this page. Never merged with the Meta number beside
 * it: an inferred count has to look different from a matched one.
 */
function CrmLeads({ entry }: { entry: RankedEntry }) {
  const page = entry.page;
  // GoHighLevel leads carry an ad name, not a page version, so they cannot be
  // divided between two versions of the same page. Showing the page's total on
  // each version row would count it twice; a dash says so instead.
  if (entry.versionStatus !== null) {
    return <Dash title="CRM leads aren't split by copy version — GoHighLevel records the ad, not which version the visitor saw" />;
  }
  if (page.crmLeads === 0) return <Dash title="No CRM lead is attributed to this page in this period" />;
  if (!page.crmInferred) {
    return (
      <span className="tabular-nums text-foreground" title="Matched by ad name (utm_content) from GoHighLevel">
        {formatCount(page.crmLeads)}
      </span>
    );
  }
  return (
    <span
      className="tabular-nums italic text-muted-foreground underline decoration-dotted underline-offset-2"
      title={`${page.crmLeads} GoHighLevel lead${page.crmLeads === 1 ? "" : "s"} carry no ad name. This is the client's only page with ad traffic, so they're shown here — inferred, not tracked: Meta recorded no ad click for them.`}
    >
      {formatCount(page.crmLeads)}*
    </span>
  );
}

/** How this row's cost per lead sits against its own client's benchmark. */
function VsBenchmark({ entry }: { entry: RankedEntry }) {
  const page = entry;
  if (page.benchmarkIndex === null) {
    const why = page.verdict === "unscored"
      ? "Not ranked: no lead recorded on any of this client's pages, so the benchmark can't be trusted"
      : page.benchmark
        ? "No leads yet, so there's no cost per lead to compare"
        : "This client has no CPL target and no leads to average, so there's nothing to compare against";
    return <Dash title={why} />;
  }
  const delta = page.benchmarkIndex - 1;
  const under = delta < 0;
  return (
    <span
      className={cn("font-medium tabular-nums", Math.abs(delta) < 0.05 ? "text-muted-foreground" : under ? "text-success" : "text-danger")}
      title={`${formatUsd(page.costPer!)} per lead vs a ${benchmarkNote(page)}`}
    >
      {under ? "−" : "+"}{Math.round(Math.abs(delta) * 100)}%
    </span>
  );
}

const benchmarkNote = (page: { benchmark: Benchmark | null }) =>
  page.benchmark
    ? `${formatUsd(page.benchmark.costPer)} ${page.benchmark.source === "target" ? "CPL target" : "account average"}`
    : "benchmark";

function EntryIdentity({ entry }: { entry: RankedEntry }) {
  const page = entry.page;
  const retired = entry.versionStatus === "off";
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <a
          href={page.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-sm text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            retired ? "text-muted-foreground" : "text-foreground",
          )}
          title={`${page.url} (opens the live page)`}
        >
          <span className="truncate">{page.label}</span>
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        </a>
        <Link
          to={`/account/${encodeURIComponent(page.accountName)}?tab=funnel`}
          className="rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {page.accountName}
        </Link>
        <VersionBadge entry={entry} />
      </div>
      <Headline entry={entry} />
      <OfferTags page={page} />
    </div>
  );
}

/**
 * Every landing page in one ranking, best to worst. Ordering is cost per lead
 * against each page's own client's benchmark, which is what lets pages from
 * different markets sit in one list; the verdict pill still carries whether the
 * gap is big enough to act on, so a page can rank first and still read
 * "Too early".
 */
function RankedPages({ entries }: { entries: RankedEntry[] }) {
  const isMobile = useIsMobile();
  const [all, setAll] = useState(false);
  const shown = all ? entries : entries.slice(0, SHOWN);
  const scaleMax = Math.max(0.05, ...entries.map((p) => p.interval?.high ?? 0));

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card" aria-labelledby="funnel-pages-heading">
      <header className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
        <ListOrdered className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h3 id="funnel-pages-heading" className="text-sm font-semibold text-foreground">
          Every landing page, best to worst
        </h3>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{entries.length}</span>
      </header>

      {isMobile ? (
        <ul className="divide-y divide-border/50">
          {shown.map((p, i) => (
            <li key={p.key} className={cn("space-y-2 p-3", p.versionStatus === "off" && "bg-muted/30")}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 w-5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
                <EntryIdentity entry={p} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <VerdictPill verdict={p.verdict} reason={p.reason} />
                <span className="text-[11px] text-muted-foreground">
                  vs benchmark <VsBenchmark entry={p} />
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div><dt className="text-muted-foreground">Spend</dt><dd className="font-medium tabular-nums text-foreground">{formatUsd(p.spend)}</dd></div>
                <div><dt className="text-muted-foreground">Leads</dt><dd className="font-medium tabular-nums text-foreground">{formatCount(p.leads)}</dd></div>
                <div><dt className="text-muted-foreground">CRM leads</dt><dd className="font-medium"><CrmLeads entry={p} /></dd></div>
                <div><dt className="text-muted-foreground">Cost / lead</dt><dd className="font-medium tabular-nums text-foreground">{p.costPer !== null ? formatUsd(p.costPer) : "—"}</dd></div>
                <div className="col-span-3"><dt className="text-muted-foreground">Conversion</dt><dd><RateBar page={p} scaleMax={scaleMax} /></dd></div>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8 text-right">#</TableHead>
                <TableHead>Page</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Page views</TableHead>
                <TableHead className="text-right" title="Website leads Meta attributed to the ads pointing here">Leads</TableHead>
                <TableHead className="text-right" title="Leads GoHighLevel holds for this page. A different source from Meta's, so the two are never added together.">
                  CRM leads
                </TableHead>
                <TableHead className="w-[150px] text-right" title="Website leads ÷ page views, with its 95% range">Conversion</TableHead>
                <TableHead className="text-right">Cost / lead</TableHead>
                <TableHead className="text-right" title="Cost per lead against this client's own CPL target, or their average when no target is set">
                  vs benchmark
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p, i) => (
                <TableRow
                  key={p.key}
                  // A version no longer taking traffic is dimmed, not dropped:
                  // its numbers are the thing the live version is judged against.
                  className={cn(p.versionStatus === "off" && "bg-muted/30 text-muted-foreground")}
                >
                  <TableCell className="py-2 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="min-w-[240px] max-w-[340px] py-2"><EntryIdentity entry={p} /></TableCell>
                  <TableCell className="py-2"><VerdictPill verdict={p.verdict} reason={p.reason} /></TableCell>
                  <TableCell className="py-2 text-right tabular-nums">{formatUsd(p.spend)}</TableCell>
                  <TableCell className="py-2 text-right tabular-nums">{formatCount(p.lpv)}</TableCell>
                  <TableCell className="py-2 text-right tabular-nums">{formatCount(p.leads)}</TableCell>
                  <TableCell className="py-2 text-right"><CrmLeads entry={p} /></TableCell>
                  <TableCell className="py-2"><RateBar page={p} scaleMax={scaleMax} /></TableCell>
                  <TableCell className="py-2 text-right tabular-nums">
                    {p.costPer !== null ? formatUsd(p.costPer, { decimals: true }) : <Dash title="No leads in this period" />}
                  </TableCell>
                  <TableCell className="py-2 text-right"><VsBenchmark entry={p} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {entries.length > SHOWN && (
        <button
          onClick={() => setAll((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-border/50 px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          {all ? "Show fewer" : `Show all ${entries.length}`}
          <ArrowRight className={cn("h-3 w-3 transition-transform", all && "-rotate-90")} aria-hidden />
        </button>
      )}
    </section>
  );
}

/** A conversion rate with its 95% range, on a scale shared by every row. */
function RateBar({ page, scaleMax }: { page: { cvr: number | null; interval: { low: number; high: number } | null }; scaleMax: number }) {
  if (page.cvr === null || !page.interval) {
    return <p className="text-right"><Dash title="More leads than page views here: Meta is undercounting views, so no rate is shown" /></p>;
  }
  const x = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const label = `${pct(page.cvr)}, 95% range ${pct(page.interval.low)}–${pct(page.interval.high)}`;
  return (
    <div className="min-w-[110px]" title={label}>
      <p className="text-right text-sm tabular-nums text-foreground">{pct(page.cvr)}</p>
      <div className="relative mt-1 h-2 w-full rounded-full bg-muted" role="img" aria-label={label}>
        <div
          className="absolute top-0 h-full rounded-full opacity-35"
          style={{ left: x(page.interval.low), width: `calc(${x(page.interval.high)} - ${x(page.interval.low)})`, background: "hsl(var(--chart-1))" }}
        />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
          style={{ left: x(page.cvr), background: "hsl(var(--chart-1))" }}
        />
      </div>
    </div>
  );
}

/** One headline or offer, pooled across clients, with its rate on a shared scale. */
function GroupRow({ group, scaleMax }: { group: CopyGroup; scaleMax: number }) {
  const s = GROUP_STATUS[group.status];
  const x = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;
  const label = group.interval && group.cvr !== null
    ? `${pct(group.cvr)}, 95% range ${pct(group.interval.low)}–${pct(group.interval.high)}`
    : "Not enough page views for a rate";
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm leading-snug text-foreground" title={group.label}>{group.label}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span title={s.help}><StatusPill status={s.status}>{s.label}</StatusPill></span>
          <span className="text-[11px] text-muted-foreground" title={group.clients.join(", ")}>
            {group.pages} {group.pages === 1 ? "page" : "pages"} · {group.clients.length}{" "}
            {group.clients.length === 1 ? "client" : "clients"} · {formatCount(group.lpv)} views
            {group.costPerLead !== null && <> · {formatUsd(group.costPerLead)}/lead</>}
          </span>
          {group.mixedPages > 0 && (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium text-warning"
              title={
                `${group.mixedPages} of these ${group.pages} pages were rewritten inside this period, so some of ` +
                `the pooled views were earned by a different headline than the one named here. Treat the rate as ` +
                `indicative until a full period runs on the current copy.`
              }
            >
              <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
              {group.mixedPages} rewritten mid-period
            </span>
          )}
        </div>
      </div>
      <div className="w-[120px] shrink-0">
        {group.cvr === null || !group.interval ? (
          <p className="text-right"><Dash title={s.help} /></p>
        ) : (
          <div title={label}>
            <p className="text-right text-sm font-semibold tabular-nums text-foreground">{pct(group.cvr)}</p>
            <div className="relative mt-1 h-2 w-full rounded-full bg-muted" role="img" aria-label={label}>
              <div
                className="absolute top-0 h-full rounded-full opacity-35"
                style={{ left: x(group.interval.low), width: `calc(${x(group.interval.high)} - ${x(group.interval.low)})`, background: "hsl(var(--chart-1))" }}
              />
              <div
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                style={{ left: x(group.cvr), background: "hsl(var(--chart-1))" }}
              />
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

/**
 * What the pages that convert have in common: the headline, or the offer.
 * Pooled across clients, because the funnels are built from shared templates —
 * which also means the traffic behind each row differs, so this ranks what to
 * test next rather than settling anything.
 */
function CopyBoard({ headlines, offers, unsynced }: { headlines: CopyGroup[]; offers: CopyGroup[]; unsynced: number }) {
  const [dim, setDim] = useState<"headline" | "offer">("headline");
  const [all, setAll] = useState(false);
  const groups = dim === "headline" ? headlines : offers;
  const shown = all ? groups : groups.slice(0, GROUPS_SHOWN);
  const scaleMax = Math.max(0.05, ...groups.map((g) => g.interval?.high ?? 0));

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card" aria-labelledby="funnel-copy-heading">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h3 id="funnel-copy-heading" className="text-sm font-semibold text-foreground">
            What the converting pages say
          </h3>
        </div>
        <SegmentedControl
          value={dim}
          onChange={setDim}
          label="Group landing pages by"
          options={[{ value: "headline", label: "Headline" }, { value: "offer", label: "Offer" }]}
        />
      </header>

      {groups.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          No landing page with ad traffic has its copy synced yet, so there's no headline or offer to compare.
        </p>
      ) : (
        <ul className="divide-y divide-border/50">
          {shown.map((g) => <GroupRow key={g.key} group={g} scaleMax={scaleMax} />)}
        </ul>
      )}

      {groups.length > GROUPS_SHOWN && (
        <button
          onClick={() => setAll((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-border/50 px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          {all ? "Show fewer" : `Show all ${groups.length}`}
          <ArrowRight className={cn("h-3 w-3 transition-transform", all && "-rotate-90")} aria-hidden />
        </button>
      )}

      {unsynced > 0 && (
        <p className="border-t border-border/50 px-4 py-2 text-[11px] text-muted-foreground">
          {unsynced} {unsynced === 1 ? "page is" : "pages are"} left out: their copy isn't synced. Register the site
          under the account's Funnel Pages and the hourly GitHub sync picks up the headline.
        </p>
      )}
    </section>
  );
}

/**
 * The funnel half of the Performance dashboard: which landing page each
 * client's website ads send traffic to, which of those pages earn their spend,
 * and which headline and offer the converting ones use. Same Meta call (and
 * cache) as the creative scorecard above it.
 */
export function PortfolioFunnelBoard({
  range,
  periodCaption,
  accounts,
  hiddenAccounts,
}: {
  range: CreativeRange;
  periodCaption: string;
  accounts: FunnelAccountInfo[];
  hiddenAccounts: string[];
}) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePortfolioCreatives(range);
  const { data: links = [], isLoading: linksLoading } = useFunnelRepoLinks();
  const { data: versions = [] } = useFunnelPageVersions();
  const period = data?.accounts.find((a) => a.period)?.period ?? null;
  const { data: ghlRows = [] } = useAllGhlConversions(period?.since ?? "");

  const ghl = useMemo((): PortfolioGhl => {
    const byAccount = new Map<string, { type: string | null; created_on: string; "Ad Name": string | null }[]>();
    for (const r of ghlRows) {
      if (!r.tecrm_id) continue;
      byAccount.set(r.tecrm_id, [...(byAccount.get(r.tecrm_id) ?? []), r]);
    }
    return { byAccount, since: period?.since, until: period?.until };
  }, [ghlRows, period]);

  const board = useMemo(
    () => analyzePortfolioFunnel(data?.accounts ?? [], accounts, links, hiddenAccounts, ghl, versions),
    [data, accounts, links, hiddenAccounts, ghl, versions],
  );

  return (
    <section className="mt-8 space-y-4" aria-labelledby="portfolio-funnel-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="portfolio-funnel-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <MousePointerClick className="h-4 w-4 text-primary" aria-hidden />
            Funnel scorecard · all clients
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Meta Ads · {periodCaption}
            {data && <> · updated {formatDistanceToNowStrict(new Date(data.fetchedAt), { addSuffix: true })}</>}
            {" · "}website ads only, each page judged on cost per lead against its own client's benchmark
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh funnel data from Meta"
          title="Refresh from Meta"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        </Button>
      </div>

      {isLoading || linksLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : isError ? (
        <SourceUnavailableNotice source="Meta Ads" message={(error as Error).message} onRetry={() => refetch()} retrying={isFetching} />
      ) : board.pages.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No website ad sent traffic to a landing page in this period.
        </p>
      ) : (
        <>
          {board.unreadable.length > 0 && (
            <SourceUnavailableNotice
              source="Meta Ads"
              stillLive="Every other client's funnel"
              message={`${board.unreadable.join(", ")}: the Meta token can't read ${board.unreadable.length === 1 ? "this ad account" : "these ad accounts"}. Assign them to the system user in Meta Business Settings.`}
            />
          )}
          {board.mixedCopyPages > 0 && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-sm">
                New page version{board.mixedCopyPages === 1 ? "" : "s"} inside this period
              </AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                {board.mixedCopyPages} {board.mixedCopyPages === 1 ? "page was" : "pages were"} rewritten while this
                period was running, so {board.mixedCopyPages === 1 ? "its" : "their"} views and leads were earned by
                more than one version of the copy. Those rows are marked <span className="font-medium">mixed</span>,
                and any pooled headline they feed is indicative only — the numbers are not yet a read on the current
                version. A full period on the new copy settles it.
              </AlertDescription>
            </Alert>
          )}
          {board.gaps.length > 0 && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-sm">Possible tracking gaps</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                No website lead recorded on any ad after real spend, so these clients' pages weren't judged:{" "}
                {board.gaps.map((g) => `${g.accountName} (${formatUsd(g.spend)})`).join("; ")}. Check the funnel's Lead event.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiStatCard
              label="Pages with traffic"
              value={formatCount(board.pages.length)}
              icon={FlaskConical}
              detail={`${board.clients} ${board.clients === 1 ? "client" : "clients"} · ${formatUsd(board.spend)} spend`}
            />
            <KpiStatCard
              label="Page conversion"
              value={board.portfolioCvr !== null ? pct(board.portfolioCvr) : "—"}
              icon={Users}
              detail={`${formatCount(board.leads)} leads from ${formatCount(board.lpv)} page views`}
            />
            <KpiStatCard
              label="Pages losing money"
              value={formatUsd(board.excess)}
              icon={OctagonX}
              detail={`${board.wasters.length} ${board.wasters.length === 1 ? "page" : "pages"} above benchmark`}
            />
            <KpiStatCard
              label="Pages beating target"
              value={formatUsd(board.savings)}
              icon={TrendingUp}
              detail={`${board.winners.length} ${board.winners.length === 1 ? "page" : "pages"} under benchmark`}
            />
          </div>

          <RankedPages entries={board.ranked} />

          <CopyBoard headlines={board.headlines} offers={board.offers} unsynced={board.unsynced} />

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Pages are ranked on cost per website lead against their own client's CPL target — or that client's own
            average when no target is set — because a $40 lead is cheap in one market and dear in another. Pages that
            spent without a lead rank below every priced page; pages with a tracking gap or no benchmark aren't ranked
            at all and sit last, since unknown isn't the same as bad. The verdict says whether the gap is big enough to
            act on, at 90% confidence with the same Poisson test the creative scorecard uses, so a page can rank first
            and still read “Too early”. Conversion is website leads ÷ landing page views, both from Meta — it isolates
            the page from the price of its traffic. Headlines and offers pool every page that uses them across clients
            and compare conversion at 95% confidence; that pooling mixes markets and audiences, so read it as the next
            test to run, not a settled answer. <strong className="font-medium text-foreground/90">CRM leads</strong> are a
            separate source — what GoHighLevel holds, matched to a page by the ad name the funnel passes through. They are
            never added to Meta's leads and never feed the ranking or the conversion rate. A count marked{" "}
            <span className="italic">1*</span> carries no ad name and is shown on the client's only page with ad traffic
            because there is nowhere else it could have come from: an inference, not a measurement, and Meta recorded no
            ad click for it.
            {board.crmUnallocated > 0 && (
              <> {formatCount(board.crmUnallocated)} CRM {board.crmUnallocated === 1 ? "lead carries" : "leads carry"} no
                ad name at a client running several pages, so {board.crmUnallocated === 1 ? "it isn't" : "they aren't"}{" "}
                shown against any page rather than being split across them.</>
            )}
          </p>
        </>
      )}
    </section>
  );
}
