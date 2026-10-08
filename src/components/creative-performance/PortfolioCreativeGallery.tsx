import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, DollarSign, OctagonX, RefreshCw, Target, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { SegmentedControl } from "@/components/SegmentedControl";
import { KpiSortControl } from "@/components/KpiSortControl";
import { sortByKpi, type SortDir } from "@/lib/kpiSort";
import { SORT_OPTIONS, adSortValue, type SortKey } from "./adSort";
import { formatCount, formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deliveryStatusText } from "./adStatus";
import { CountFilter } from "./CountFilter";
import { NO_COUNT_FILTER, describeCount, passesCount, type CountFilterValue } from "./countThreshold";
import { CreativeName, CreativeThumbnail, Dash } from "./CreativeBits";
import { usePortfolioCreatives, type CreativeRange, type LeadChannel } from "./useCreativePerformance";
import { useSettings } from "@/hooks/useSettings";
import { FATIGUE_FREQUENCY, hookRate, portfolioAdRates, portfolioCostPer, scoreAds, type Benchmark, type ScoredAd } from "./verdicts";
import { GradedValue } from "@/components/dashboard/CostVsTarget";
import { costStatus, rateStatus } from "@/components/dashboard/portfolioBenchmark";

const CHANNEL_LABEL: Record<LeadChannel, string> = { website: "Website leads", form: "Lead forms" };
const LEAD_NOUN: Record<LeadChannel, string> = { website: "Website leads", form: "Form leads" };

const ALL = "all";

/** What the gallery needs to know about each CRM account to judge its ads. */
export interface PortfolioAccountInfo {
  id: string;
  account_name: string;
  target_cpl: number | null;
}

type Row = ScoredAd & {
  accountId: string;
  accountName: string;
  channel: LeadChannel;
  benchmark: Benchmark | null;
  trackingGap: boolean;
};

function Metric({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div title={title}>
      <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/** One ad, big enough to judge the creative itself rather than just its name. */
/** The portfolio's own figures on one lead source: what each ad's numbers are graded against. */
type ChannelBars = { cpl: Benchmark | null; linkCtr: number | null; hookRate: number | null };

const vsAvg = (value: string, avg: string) => `${value} vs ${avg} portfolio avg`;

function AdCard({ row, rank, shareOfSpend, showAccount, bars }: { row: Row; rank: number; shareOfSpend: number | null; showAccount: boolean; bars: ChannelBars }) {
  const { ad } = row;
  const hook = hookRate(ad);
  const headline = ad.copy.headlines[0] ?? null;
  return (
    <li
      className={cn(
        "flex flex-col gap-4 p-4 sm:flex-row transition-[opacity,filter]",
        // Paused ads dim as a whole row so they stand out when scanning; hover or
        // keyboard focus brings one back to full contrast for reading.
        !ad.live && "bg-muted/40 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 focus-within:opacity-100 focus-within:grayscale-0",
      )}
    >
      <div className="flex shrink-0 items-start gap-3">
        <span className="w-5 pt-1 text-right text-xs font-semibold tabular-nums text-muted-foreground" aria-hidden>
          {rank}
        </span>
        <CreativeThumbnail ad={ad} size="xl" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CreativeName
            ad={ad}
            sub={
              <>
                {showAccount && (
                  <>
                    <Link
                      to={`/account/${encodeURIComponent(row.accountName)}?tab=performance`}
                      className="rounded-sm font-medium text-foreground/80 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {row.accountName}
                    </Link>
                    {" · "}
                  </>
                )}
                {ad.live ? (ad.format === "video" ? "Video" : "Image") : deliveryStatusText(ad.status)}
                {ad.adset && <> · {ad.adset}</>}
              </>
            }
          />
          <div className="shrink-0 text-right">
            <p className="text-base font-semibold tabular-nums text-foreground">{formatUsd(ad.spend, { decimals: true })}</p>
            <p className="text-[11px] text-muted-foreground">
              spend{shareOfSpend !== null && <> · {Math.round(shareOfSpend * 100)}% of listed</>}
            </p>
          </div>
        </div>

        {headline && (
          <p className="line-clamp-2 text-xs italic text-muted-foreground" title={headline}>
            &ldquo;{headline}&rdquo;
          </p>
        )}

        {ad.delivered ? (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
              <Metric label={LEAD_NOUN[row.channel]} value={formatCount(row.results)} />
              <Metric
                label="Cost / lead"
                value={
                  row.costPer !== null ? (
                    <GradedValue
                      text={formatUsd(row.costPer, { decimals: true })}
                      status={bars.cpl ? costStatus(row.costPer, bars.cpl.costPer) : null}
                      title={bars.cpl ? vsAvg(formatUsd(row.costPer, { decimals: true }), formatUsd(bars.cpl.costPer, { decimals: true })) : undefined}
                    />
                  ) : (
                    <Dash title="No leads in this period" />
                  )
                }
              />
              {ad.appointments !== null && <Metric label="Appts" value={formatCount(ad.appointments)} title="Meta Schedule events credited to this ad" />}
              <Metric
                label="Link CTR"
                value={
                  ad.linkCtr !== null ? (
                    <GradedValue
                      text={formatPercent(ad.linkCtr)}
                      status={rateStatus(ad.linkCtr, bars.linkCtr)}
                      title={bars.linkCtr !== null ? vsAvg(formatPercent(ad.linkCtr), formatPercent(bars.linkCtr)) : undefined}
                    />
                  ) : (
                    <Dash title="No link clicks" />
                  )
                }
              />
              {ad.format === "video" && (
                <Metric
                  label="Hook"
                  value={
                    hook !== null ? (
                      <GradedValue
                        text={formatPercent(hook, 1)}
                        status={rateStatus(hook, bars.hookRate)}
                        title={`3-second plays ÷ impressions${bars.hookRate !== null ? ` · ${vsAvg(formatPercent(hook, 1), formatPercent(bars.hookRate, 1))}` : ""}`}
                      />
                    ) : (
                      <Dash title="No impressions" />
                    )
                  }
                />
              )}
              <Metric
                label="Frequency"
                value={
                  ad.frequency !== null ? (
                    <span className={cn(row.fatigued && "font-semibold text-warning")}>{ad.frequency.toFixed(1)}</span>
                  ) : (
                    <Dash title="No delivery" />
                  )
                }
                title={row.fatigued ? `At or above ${FATIGUE_FREQUENCY}: fatigue risk` : undefined}
              />
            </dl>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Live, no delivery in this period</p>
        )}
      </div>
    </li>
  );
}

/**
 * Every ad the agency is running, biggest spender first, with the creative
 * shown large enough to actually look at.
 *
 * One lead source at a time (the switch above the list): website leads are the
 * pixel's Lead event and instant-form leads are Meta's own form submissions —
 * they differ too much in price and quality to rank in one column. Each ad is
 * judged against its own client's benchmark, so a $40 lead in an expensive
 * market isn't beaten by a $12 one somewhere else on price alone.
 *
 * With `accountId` it is the same gallery for one client (the account page):
 * the client picker and per-ad client names drop away, and nothing else
 * changes, so an ad reads identically on both screens.
 */
export function PortfolioCreativeGallery({
  range,
  periodCaption,
  accounts,
  hiddenAccounts,
  accountId,
}: {
  range: CreativeRange;
  periodCaption: string;
  accounts: PortfolioAccountInfo[];
  hiddenAccounts: string[];
  /** Show one client only. Hidden-account settings don't apply to a client opened directly. */
  accountId?: string;
}) {
  // One portfolio query for every screen and every client: the account page
  // reuses the cache /creatives, /funnels and the dashboard already filled.
  const { data, isLoading, isError, error, refetch, isFetching } = usePortfolioCreatives(range);
  const scoped = !!accountId;
  const [accountPick, setAccount] = useState<string>(ALL);
  const account = accountId ?? accountPick;
  const [channelPick, setChannelPick] = useState<LeadChannel | null>(null);
  // Leads count the source on screen (website or form), so one control serves both.
  const [leadFilter, setLeadFilter] = useState<CountFilterValue>(NO_COUNT_FILTER);
  const [apptFilter, setApptFilter] = useState<CountFilterValue>(NO_COUNT_FILTER);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "spend", dir: "desc" });

  // One bar per channel for every client, pooled across the visible portfolio
  // (not the scoped client alone), so an ad reads the same on every screen.
  const { settings } = useSettings();
  const portfolioBars = useMemo(() => {
    const hidden = settings.hidden_accounts ?? [];
    const all = data?.accounts ?? [];
    const bars = (channel: "website" | "form"): ChannelBars => ({
      cpl: portfolioCostPer(all, channel, "leads", hidden),
      ...portfolioAdRates(all, channel, hidden),
    });
    return { website: bars("website"), form: bars("form") };
  }, [data, settings.hidden_accounts]);

  const { rows, unreadable, gaps, accountOptions } = useMemo(() => {
    const rows: Row[] = [];
    const unreadable: string[] = [];
    const gaps: { accountId: string; accountName: string; channel: LeadChannel; spend: number }[] = [];
    const spendByAccount = new Map<string, { name: string; spend: number }>();

    for (const acct of data?.accounts ?? []) {
      if (accountId ? acct.accountId !== accountId : hiddenAccounts.includes(acct.accountName)) continue;
      if (acct.error) {
        unreadable.push(acct.accountName);
        continue;
      }
      const ads = acct.ads ?? [];
      if (ads.length === 0) continue;
      for (const channel of ["website", "form"] as const) {
        const chAds = ads.filter((a) => a.leadChannel === channel);
        if (chAds.length === 0) continue;
        const sc = scoreAds(chAds, "leads", portfolioBars[channel].cpl);
        if (sc.trackingGap) gaps.push({ accountId: acct.accountId, accountName: acct.accountName, channel, spend: sc.spend });
        for (const s of sc.scored) {
          if (!s.ad.delivered && !s.ad.live) continue;
          rows.push({
            ...s,
            accountId: acct.accountId,
            accountName: acct.accountName,
            channel,
            benchmark: sc.benchmark,
            trackingGap: sc.trackingGap,
          });
        }
      }
      const spend = ads.reduce((s, a) => s + a.spend, 0);
      spendByAccount.set(acct.accountId, { name: acct.accountName, spend });
    }

    const accountOptions = [...spendByAccount.entries()]
      .sort((a, b) => b[1].spend - a[1].spend)
      .map(([id, v]) => ({ id, name: v.name }));
    return { rows, unreadable, gaps, accountOptions };
  }, [data, hiddenAccounts, accountId, portfolioBars]);

  // The account picked decides which lead source opens: a client that only runs
  // instant forms shouldn't land on an empty "website leads" list.
  const inAccount = useMemo(() => rows.filter((r) => account === ALL || r.accountId === account), [rows, account]);
  const channelSpend = (c: LeadChannel) => inAccount.filter((r) => r.channel === c).reduce((s, r) => s + r.ad.spend, 0);
  const channelCount = (c: LeadChannel) => inAccount.filter((r) => r.channel === c).length;
  const hasChannel = (c: LeadChannel) => channelCount(c) > 0;
  const derived: LeadChannel = channelSpend("form") > channelSpend("website") ? "form" : "website";
  const channel = channelPick && hasChannel(channelPick) ? channelPick : derived;

  const listed = useMemo(
    () => {
      const shown = inAccount
        .filter((r) => r.channel === channel)
        // An ad that didn't deliver has nothing to compare (not zero leads), and an
        // account that doesn't track appointments has unknown appts (not zero):
        // both drop out while a filter is on.
        .filter((r) => passesCount(r.ad.delivered ? r.results : null, leadFilter))
        .filter((r) => passesCount(r.ad.delivered ? r.ad.appointments : null, apptFilter));
      // Ads that are live but haven't delivered always sit at the end, where they
      // read as "nothing to judge yet" rather than as the best or worst ads. Ties
      // (and unknowns) fall back to biggest spender first.
      const delivered = shown.filter((r) => r.ad.delivered);
      const idle = shown.filter((r) => !r.ad.delivered);
      return [
        ...sortByKpi(delivered, (r) => adSortValue(r, sort.key), sort.dir, (a, b) => b.ad.spend - a.ad.spend),
        ...idle,
      ];
    },
    [inAccount, channel, leadFilter, apptFilter, sort],
  );

  const totals = useMemo(() => {
    const spend = listed.reduce((s, r) => s + r.ad.spend, 0);
    const leads = listed.reduce((s, r) => s + (r.ad.delivered ? r.results : 0), 0);
    const winners = listed.filter((r) => r.verdict === "winner");
    const wasters = listed.filter((r) => r.verdict === "waster");
    const clients = new Set(listed.map((r) => r.accountId)).size;
    const delivered = listed.filter((r) => r.ad.delivered && r.ad.spend > 0).length;
    return {
      spend,
      leads,
      clients,
      delivered,
      winners,
      wasters,
      winnerSpend: winners.reduce((s, r) => s + r.ad.spend, 0),
      wasterSpend: wasters.reduce((s, r) => s + r.ad.spend, 0),
      // Verdicts are withheld wholesale when every listed ad sits under a
      // tracking gap: the tiles must not read "0 wasters" as an all-clear.
      withheld: listed.length > 0 && listed.every((r) => r.trackingGap),
      unbenchmarked: listed.length > 0 && listed.every((r) => !r.benchmark),
    };
  }, [listed]);

  const countFilterText = [
    describeCount(leadFilter, LEAD_NOUN[channel].toLowerCase()),
    describeCount(apptFilter, "appts"),
  ].filter(Boolean).join(" and ");
  const pct = (n: number) => (totals.spend > 0 ? `${Math.round((n / totals.spend) * 100)}% of spend` : "");
  const listedGaps = gaps.filter((g) => g.channel === channel && (account === ALL || g.accountId === account));

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)}
        </div>
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[232px] rounded-xl" />)}
      </div>
    );
  }

  if (isError) {
    return <SourceUnavailableNotice source="Meta Ads" message={(error as Error).message} onRetry={() => refetch()} retrying={isFetching} />;
  }

  // A client with no Meta ad account linked is absent from the response: its
  // creatives are unknown, which must not read as "no ads ran".
  const scopedAccount = scoped ? data?.accounts.find((a) => a.accountId === accountId) : undefined;
  if (scoped && data && !scopedAccount) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No Meta ad account is linked to this client, so there are no creatives to show.
      </p>
    );
  }
  // Meta refused this one account: its creatives are unknown, so no tiles at all
  // rather than tiles reading $0 and "no ads".
  if (scopedAccount?.error) {
    return (
      <SourceUnavailableNotice
        source="Meta Ads"
        message={`The Meta token can't read ${scopedAccount.accountName}'s ad account. Assign it to the system user in Meta Business Settings.`}
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    );
  }

  return (
    <div className="space-y-4">
      {unreadable.length > 0 && (
        <SourceUnavailableNotice
          source="Meta Ads"
          stillLive={scoped ? undefined : "Every other client's creatives"}
          message={`${unreadable.join(", ")}: the Meta token can't read ${unreadable.length === 1 ? "this ad account" : "these ad accounts"}. Assign ${unreadable.length === 1 ? "it" : "them"} to the system user in Meta Business Settings.`}
        />
      )}

      {listedGaps.length > 0 && (
        <Alert className="border-warning/40 bg-warning/10">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertTitle className="text-sm">Possible tracking gaps</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground">
            No {CHANNEL_LABEL[channel].toLowerCase()} recorded on any ad after real spend, so these ads aren't judged:{" "}
            {listedGaps.map((g) => `${g.accountName} (${formatUsd(g.spend)})`).join("; ")}. Check the funnel's Lead event.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <KpiStatCard
          label="Spend"
          value={formatUsd(totals.spend)}
          icon={DollarSign}
          detail={
            `${totals.delivered} ${totals.delivered === 1 ? "ad" : "ads"}` +
            (scoped ? "" : ` · ${totals.clients} ${totals.clients === 1 ? "client" : "clients"}`)
          }
        />
        <KpiStatCard
          label={LEAD_NOUN[channel]}
          value={formatCount(totals.leads)}
          icon={Target}
          detail={
            totals.leads > 0
              ? `${formatUsd(totals.spend / totals.leads, { decimals: true })} blended cost per lead`
              : totals.withheld
                ? "None recorded — check tracking"
                : "None in this period"
          }
        />
        <KpiStatCard
          label="Money wasters"
          value={formatUsd(totals.wasterSpend)}
          icon={OctagonX}
          unavailable={totals.withheld || totals.unbenchmarked}
          unavailableReason={totals.withheld ? "Withheld: check tracking" : "No benchmark"}
          detail={`${totals.wasters.length} ${totals.wasters.length === 1 ? "ad" : "ads"} · ${pct(totals.wasterSpend)}`}
        />
        <KpiStatCard
          label="Winners"
          value={formatUsd(totals.winnerSpend)}
          icon={TrendingUp}
          unavailable={totals.withheld || totals.unbenchmarked}
          unavailableReason={totals.withheld ? "Withheld: check tracking" : "No benchmark"}
          detail={`${totals.winners.length} ${totals.winners.length === 1 ? "ad" : "ads"} · ${pct(totals.winnerSpend)}`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {!scoped && (
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger className="h-8 w-[200px] text-xs" aria-label="Filter by ad account">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="text-xs">All ad accounts</SelectItem>
                {accountOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <SegmentedControl
            value={channel}
            onChange={setChannelPick}
            label="Lead source"
            options={[
              {
                value: "website",
                label: `Website leads · ${channelCount("website")}`,
                disabled: !hasChannel("website"),
                title: "Ads that send people to a landing page, scored on the pixel's Lead event",
              },
              {
                value: "form",
                label: `Lead forms · ${channelCount("form")}`,
                disabled: !hasChannel("form"),
                title: "Ads that open a Meta instant form, scored on form submissions",
              },
            ]}
          />
          <CountFilter
            value={leadFilter}
            onChange={setLeadFilter}
            noun={LEAD_NOUN[channel].toLowerCase()}
            anyLabel="Any lead count"
          />
          <CountFilter value={apptFilter} onChange={setApptFilter} noun="appts" anyLabel="Any appt count" />
          <KpiSortControl options={SORT_OPTIONS} value={sort.key} dir={sort.dir} onChange={(key, dir) => setSort({ key, dir })} />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => refetch()}
          disabled={isFetching}
          aria-label="Refresh from Meta"
          title="Refresh from Meta"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        </Button>
      </div>

      {(() => {
        const b = portfolioBars[channel];
        if (!b.cpl && b.linkCtr === null) return null;
        return (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Portfolio average</span>
            {b.cpl && <> · Cost / lead <span className="font-semibold tabular-nums text-foreground">{formatUsd(b.cpl.costPer, { decimals: true })}</span></>}
            {b.linkCtr !== null && <> · Link CTR <span className="font-semibold tabular-nums text-foreground">{formatPercent(b.linkCtr)}</span></>}
            {b.hookRate !== null && <> · Hook <span className="font-semibold tabular-nums text-foreground">{formatPercent(b.hookRate, 1)}</span></>}
            {" "}on {CHANNEL_LABEL[channel].toLowerCase()} ads{scoped ? " across every client" : ""}.
          </p>
        );
      })()}

      {listed.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No ads delivered in this period, and none are live."
            : countFilterText
              ? `No ads with ${countFilterText} in this period.`
              : hasChannel(channel === "website" ? "form" : "website")
              ? `No ${CHANNEL_LABEL[channel].toLowerCase()} ads here in this period — switch the lead source above.`
              : "No ads match this filter."}
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
          {listed.map((r, i) => (
            <AdCard
              key={`${r.accountId}-${r.ad.id}`}
              row={r}
              rank={i + 1}
              shareOfSpend={totals.spend > 0 && r.ad.delivered ? r.ad.spend / totals.spend : null}
              showAccount={!scoped}
              bars={portfolioBars[channel]}
            />
          ))}
        </ul>
      )}
      <footer className="space-y-1 border-t border-border/60 pt-3">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Meta Ads · {periodCaption}
          {data && <> · updated {formatDistanceToNowStrict(new Date(data.fetchedAt), { addSuffix: true })}</>}
          {" · "}sorted by {SORT_OPTIONS.find((o) => o.key === sort.key)!.label.toLowerCase()},{" "}
          {sort.dir === "asc" ? "lowest" : "highest"} first; ads with no figure for it sit last. {CHANNEL_LABEL[channel]} only: website and instant-form leads cost too
          differently to rank together, so one source shows at a time. Cost / lead, Link CTR and Hook are graded
          against the whole portfolio&rsquo;s {CHANNEL_LABEL[channel].toLowerCase()} ads{scoped ? ", not this client's own" : ""}: green at or better, amber a
          little worse, red well off. Paused ads that spent in the period are listed and greyed.
        </p>
      </footer>
    </div>
  );
}
