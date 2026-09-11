import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, ArrowRight, DollarSign, OctagonX, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CreativeThumbnail } from "./CreativeBits";
import { usePortfolioCreatives, type CreativeRange, type LeadChannel } from "./useCreativePerformance";
import { scoreAds, targetFor, type ScoredAd } from "./verdicts";

const SHOWN = 6;
const CHANNEL: Record<LeadChannel, string> = { website: "website leads", form: "instant-form leads" };

type Row = ScoredAd & { accountId: string; accountName: string; channel: LeadChannel };

export interface PortfolioAccountInfo {
  id: string;
  account_name: string;
  target_cpl: number | null;
}

function AdRow({ row, kind }: { row: Row; kind: "winner" | "waster" }) {
  const href = `/account/${encodeURIComponent(row.accountName)}?tab=performance`;
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <CreativeThumbnail ad={row.ad} size="sm" />
      <div className="min-w-0 flex-1">
        <a
          href={row.ad.adsManagerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate rounded-sm text-sm font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={`${row.ad.name} (open in Ads Manager)`}
        >
          {row.ad.name}
        </a>
        <p className="truncate text-xs text-muted-foreground">
          <Link to={href} className="rounded-sm font-medium text-foreground/80 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {row.accountName}
          </Link>
          {" · "}{CHANNEL[row.channel]}
          {!row.ad.live && <> · {kind === "waster" ? "already off" : "paused"}</>}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-foreground/80">{row.reason}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {formatUsd(kind === "waster" ? row.excessSpend : row.savings)}
        </p>
        <p className="text-[11px] text-muted-foreground">{kind === "waster" ? "excess" : "under benchmark"}</p>
      </div>
    </li>
  );
}

function List({ title, icon: Icon, tone, rows, kind, empty }: {
  title: string;
  icon: React.ElementType;
  tone: string;
  rows: Row[];
  kind: "winner" | "waster";
  empty: string;
}) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, SHOWN);
  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card" aria-label={title}>
      <header className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-4 py-3">
        <Icon className={cn("h-4 w-4", tone)} aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{rows.length}</span>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border/50">{shown.map((r) => <AdRow key={`${r.accountId}-${r.ad.id}`} row={r} kind={kind} />)}</ul>
      )}
      {rows.length > SHOWN && (
        <button
          onClick={() => setAll((v) => !v)}
          className="mt-auto flex w-full items-center justify-center gap-1 border-t border-border/50 px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          {all ? "Show fewer" : `Show all ${rows.length}`}
          <ArrowRight className={cn("h-3 w-3 transition-transform", all && "-rotate-90")} aria-hidden />
        </button>
      )}
    </section>
  );
}

/**
 * Best performers and money wasters across every client, for the period on the
 * Performance page. Each ad is judged against its own client's CPL target (or
 * that client's average when no target is set), within its own lead source, so
 * a $12 instant-form lead in one market never outranks a $45 website lead in
 * another on price alone.
 */
export function PortfolioCreativeBoard({
  range,
  periodCaption,
  accounts,
  hiddenAccounts,
}: {
  range: CreativeRange;
  periodCaption: string;
  accounts: PortfolioAccountInfo[];
  hiddenAccounts: string[];
}) {
  const { data, isLoading, isError, error, refetch, isFetching } = usePortfolioCreatives(range);

  const board = useMemo(() => {
    const winners: Row[] = [];
    const wasters: Row[] = [];
    const gaps: { accountName: string; channel: LeadChannel; spend: number }[] = [];
    const unreadable: string[] = [];
    let spend = 0;
    let clients = 0;
    for (const acct of data?.accounts ?? []) {
      if (hiddenAccounts.includes(acct.accountName)) continue;
      if (acct.error) {
        unreadable.push(acct.accountName);
        continue;
      }
      const ads = acct.ads ?? [];
      const cpl = accounts.find((a) => a.id === acct.accountId)?.target_cpl ?? null;
      let counted = false;
      for (const channel of ["website", "form"] as const) {
        const chAds = ads.filter((a) => a.leadChannel === channel);
        const sc = scoreAds(chAds, "leads", targetFor(channel, "leads", { cpl, cpa: null }));
        if (sc.spend <= 0) continue;
        counted = true;
        spend += sc.spend;
        if (sc.trackingGap) gaps.push({ accountName: acct.accountName, channel, spend: sc.spend });
        const tag = (s: ScoredAd): Row => ({ ...s, accountId: acct.accountId, accountName: acct.accountName, channel });
        winners.push(...sc.winners.map(tag));
        wasters.push(...sc.wasters.map(tag));
      }
      if (counted) clients += 1;
    }
    // Live first on both lists: a paused winner can't be scaled today, and a
    // paused waster already cost what it'll cost.
    winners.sort((a, b) => Number(b.ad.live) - Number(a.ad.live) || b.savings - a.savings);
    wasters.sort((a, b) => Number(b.ad.live) - Number(a.ad.live) || b.excessSpend - a.excessSpend);
    return {
      winners,
      wasters,
      gaps,
      unreadable,
      spend,
      clients,
      wasterSpend: wasters.reduce((s, w) => s + w.ad.spend, 0),
      liveWasterSpend: wasters.filter((w) => w.ad.live).reduce((s, w) => s + w.ad.spend, 0),
      excess: wasters.reduce((s, w) => s + w.excessSpend, 0),
      winnerSpend: winners.reduce((s, w) => s + w.ad.spend, 0),
    };
  }, [data, accounts, hiddenAccounts]);

  const pct = (n: number) => (board.spend > 0 ? `${Math.round((n / board.spend) * 100)}% of spend` : "");
  const liveWasters = board.wasters.filter((w) => w.ad.live).length;

  return (
    <section className="mt-8 space-y-4" aria-labelledby="portfolio-creatives-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="portfolio-creatives-heading" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Creative scorecard · all clients
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Meta Ads · {periodCaption}
            {data && <> · updated {formatDistanceToNowStrict(new Date(data.fetchedAt), { addSuffix: true })}</>}
            {" · "}website ads vs each client's CPL target, instant forms vs that client's form average
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh creatives from Meta" title="Refresh from Meta">
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)}</div>
          <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}</div>
        </div>
      ) : isError ? (
        <SourceUnavailableNotice source="Meta Ads" message={(error as Error).message} onRetry={() => refetch()} retrying={isFetching} />
      ) : (
        <>
          {board.unreadable.length > 0 && (
            <SourceUnavailableNotice
              source="Meta Ads"
              stillLive="Every other client's creatives"
              message={`${board.unreadable.join(", ")}: the Meta token can't read ${board.unreadable.length === 1 ? "this ad account" : "these ad accounts"}. Assign them to the system user in Meta Business Settings.`}
            />
          )}
          {board.gaps.length > 0 && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-sm">Possible tracking gaps</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                No leads recorded on any ad after real spend, so these weren't judged:{" "}
                {board.gaps.map((g) => `${g.accountName} (${CHANNEL[g.channel]}, ${formatUsd(g.spend)})`).join("; ")}. Check the funnel's Lead event.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiStatCard label="Spend analysed" value={formatUsd(board.spend)} icon={DollarSign} detail={`${board.clients} ${board.clients === 1 ? "client" : "clients"}`} />
            <KpiStatCard
              label="Money wasters"
              value={formatUsd(board.wasterSpend)}
              icon={OctagonX}
              detail={`${board.wasters.length} ads · ${pct(board.wasterSpend)}`}
            />
            <KpiStatCard
              label="Still burning"
              value={formatUsd(board.liveWasterSpend)}
              icon={AlertTriangle}
              detail={`${liveWasters} money ${liveWasters === 1 ? "waster is" : "wasters are"} still live`}
            />
            <KpiStatCard label="Winners" value={formatUsd(board.winnerSpend)} icon={TrendingUp} detail={`${board.winners.length} ads · ${pct(board.winnerSpend)}`} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <List
              title="Top performers"
              icon={TrendingUp}
              tone="text-success"
              kind="winner"
              rows={board.winners}
              empty="No ad beats its client's target with enough leads to be sure yet."
            />
            <List
              title="Money wasters"
              icon={OctagonX}
              tone="text-danger"
              kind="waster"
              rows={board.wasters}
              empty="No money wasters: every ad with enough spend to judge is within range of its client's target."
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Top performers beat their benchmark with 90% confidence and by 15%+; money wasters miss it with 90% confidence
            by 25%+ or have no leads after ~2.3× the benchmark in spend. The benchmark is the client's CPL target for website
            ads (or their average when unset) and the client's own form-lead average for instant forms, which are cheaper by
            nature. “Excess” is spend beyond what the ad's leads were worth at benchmark; “under benchmark” is the reverse.
          </p>
        </>
      )}
    </section>
  );
}
