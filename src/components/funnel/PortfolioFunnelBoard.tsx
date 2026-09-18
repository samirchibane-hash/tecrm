import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  FlaskConical,
  MousePointerClick,
  OctagonX,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { SegmentedControl } from "@/components/SegmentedControl";
import { StatusPill } from "@/components/StatusPill";
import { Dash } from "@/components/creative-performance/CreativeBits";
import { ANGLE_LABEL, OFFER_LABEL } from "@/components/creative-performance/labels";
import { usePortfolioCreatives, type CreativeRange } from "@/components/creative-performance/useCreativePerformance";
import { useFunnelRepoLinks } from "@/components/funnel-pages/useAccountLinks";
import { formatCount, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  MIN_GROUP_VIEWS,
  analyzePortfolioFunnel,
  type CopyGroup,
  type FunnelAccountInfo,
  type PortfolioPage,
} from "./portfolioFunnel";

const SHOWN = 5;
const GROUPS_SHOWN = 5;

const pct = (r: number) => `${(r * 100).toFixed(1)}%`;

const GROUP_STATUS: Record<CopyGroup["status"], { status: "success" | "danger" | "neutral"; label: string; help: string }> = {
  best: { status: "success", label: "Best converting", help: "The highest conversion rate of any headline or offer with enough traffic to rank" },
  behind: { status: "danger", label: "Behind", help: "Converts worse than the best one, at 95% confidence" },
  even: { status: "neutral", label: "Too close to call", help: "Not significantly different from the best one yet" },
  needs_traffic: { status: "neutral", label: "Needs traffic", help: `Fewer than ${MIN_GROUP_VIEWS} pooled page views: too few to rank` },
};

/** A page's own hero headline — the thing the scorecard exists to compare. */
function Headline({ page }: { page: PortfolioPage }) {
  if (!page.headline) {
    return (
      <p className="mt-1 text-xs italic text-muted-foreground">
        Headline not synced — register this site under Funnel Pages to read its copy
      </p>
    );
  }
  return (
    <p className="mt-1 line-clamp-2 text-xs leading-snug text-foreground/90" title={page.copy ?? page.headline}>
      “{page.headline}”
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

function PageRow({ page, kind }: { page: PortfolioPage; kind: "winner" | "waster" }) {
  const href = `/account/${encodeURIComponent(page.accountName)}?tab=funnel`;
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <a
              href={page.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 rounded-sm text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title={`${page.url} (opens the live page)`}
            >
              <span className="truncate">{page.label}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            </a>
            <Link
              to={href}
              className="rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {page.accountName}
            </Link>
          </div>
          <Headline page={page} />
          <OfferTags page={page} />
          <p className="mt-1 text-xs leading-snug text-foreground/80">{page.reason}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {formatUsd(kind === "waster" ? page.excessSpend : page.savings)}
          </p>
          <p className="text-[11px] text-muted-foreground">{kind === "waster" ? "excess" : "under benchmark"}</p>
          <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
            {page.cvr !== null ? `${pct(page.cvr)} convert` : "rate unknown"}
          </p>
        </div>
      </div>
    </li>
  );
}

function PageList({ title, icon: Icon, tone, pages, kind, empty }: {
  title: string;
  icon: React.ElementType;
  tone: string;
  pages: PortfolioPage[];
  kind: "winner" | "waster";
  empty: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? pages : pages.slice(0, SHOWN);
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card" aria-label={title}>
      <header className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
        <Icon className={cn("h-4 w-4", tone)} aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{pages.length}</span>
      </header>
      {pages.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/50">
          {shown.map((p) => <PageRow key={`${p.accountId}-${p.key}`} page={p} kind={kind} />)}
        </ul>
      )}
      {pages.length > SHOWN && (
        <button
          onClick={() => setAll((v) => !v)}
          className="mt-auto flex w-full items-center justify-center gap-1 border-t border-border/50 px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          {all ? "Show fewer" : `Show all ${pages.length}`}
          <ArrowRight className={cn("h-3 w-3 transition-transform", all && "-rotate-90")} aria-hidden />
        </button>
      )}
    </section>
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

  const board = useMemo(
    () => analyzePortfolioFunnel(data?.accounts ?? [], accounts, links, hiddenAccounts),
    [data, accounts, links, hiddenAccounts],
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

          <div className="grid gap-3 lg:grid-cols-2">
            <PageList
              title="Top performing pages"
              icon={TrendingUp}
              tone="text-success"
              kind="winner"
              pages={board.winners}
              empty="No landing page beats its client's cost-per-lead benchmark with enough leads to be sure yet."
            />
            <PageList
              title="Pages losing money"
              icon={OctagonX}
              tone="text-danger"
              kind="waster"
              pages={board.wasters}
              empty="No page is significantly above its client's cost-per-lead benchmark."
            />
          </div>

          <CopyBoard headlines={board.headlines} offers={board.offers} unsynced={board.unsynced} />

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A page's verdict is about money: its website leads and spend against that client's CPL target (or that
            client's own average when no target is set), with the same 90% Poisson test the creative scorecard uses.
            Conversion is website leads ÷ landing page views, both from Meta — it isolates the page from the price of
            its traffic, so a page can convert well and still cost too much per lead. Headlines and offers pool every
            page that uses them across clients and compare conversion at 95% confidence; that pooling mixes markets and
            audiences, so read it as the next test to run, not a settled answer.
          </p>
        </>
      )}
    </section>
  );
}
