import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, DollarSign, OctagonX, RefreshCw, Target, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { SegmentedControl } from "@/components/SegmentedControl";
import { formatCount, formatPercent, formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";
import { deliveryStatusText } from "./adStatus";
import { CreativeName, CreativeThumbnail, Dash, VerdictPill } from "./CreativeBits";
import type { PortfolioAccountInfo } from "./PortfolioCreativeBoard";
import { usePortfolioCreatives, type CreativeRange, type LeadChannel } from "./useCreativePerformance";
import { FATIGUE_FREQUENCY, benchmarkText, hookRate, scoreAds, targetFor, type Benchmark, type ScoredAd } from "./verdicts";

const CHANNEL_LABEL: Record<LeadChannel, string> = { website: "Website leads", form: "Lead forms" };
const LEAD_NOUN: Record<LeadChannel, string> = { website: "Website leads", form: "Form leads" };

const ALL = "all";

// Lead-count filter. Counts the lead source on screen (website or form leads),
// so one control serves both. Strict comparisons, matching the labels.
type LeadOp = "any" | "gt" | "lt";
const LEAD_OP_LABEL: Record<LeadOp, string> = { any: "Any lead count", gt: "More than", lt: "Fewer than" };

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
function AdCard({ row, rank, shareOfSpend }: { row: Row; rank: number; shareOfSpend: number | null }) {
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
                <Link
                  to={`/account/${encodeURIComponent(row.accountName)}?tab=performance`}
                  className="rounded-sm font-medium text-foreground/80 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {row.accountName}
                </Link>
                {" · "}
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <VerdictPill verdict={row.verdict} reason={row.reason} />
              <p className="text-[11px] text-muted-foreground">{row.reason}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
              <Metric label={LEAD_NOUN[row.channel]} value={formatCount(row.results)} />
              <Metric
                label="Cost / lead"
                value={row.costPer !== null ? formatUsd(row.costPer, { decimals: true }) : <Dash title="No leads in this period" />}
                title={row.benchmark ? `Benchmark ${benchmarkText(row.benchmark, "leads")}` : "No benchmark for this client yet"}
              />
              {ad.appointments !== null && <Metric label="Appts" value={formatCount(ad.appointments)} title="Meta Schedule events credited to this ad" />}
              <Metric
                label="Link CTR"
                value={ad.linkCtr !== null ? formatPercent(ad.linkCtr) : <Dash title="No link clicks" />}
              />
              {ad.format === "video" && (
                <Metric
                  label="Hook"
                  value={hook !== null ? formatPercent(hook, 1) : <Dash title="No impressions" />}
                  title="3-second plays ÷ impressions"
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
 */
export function PortfolioCreativeGallery({
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
  const [account, setAccount] = useState<string>(ALL);
  const [channelPick, setChannelPick] = useState<LeadChannel | null>(null);
  const [leadOp, setLeadOp] = useState<LeadOp>("any");
  const [leadCount, setLeadCount] = useState("");

  const { rows, unreadable, gaps, accountOptions } = useMemo(() => {
    const rows: Row[] = [];
    const unreadable: string[] = [];
    const gaps: { accountId: string; accountName: string; channel: LeadChannel; spend: number }[] = [];
    const spendByAccount = new Map<string, { name: string; spend: number }>();

    for (const acct of data?.accounts ?? []) {
      if (hiddenAccounts.includes(acct.accountName)) continue;
      if (acct.error) {
        unreadable.push(acct.accountName);
        continue;
      }
      const ads = acct.ads ?? [];
      if (ads.length === 0) continue;
      const cpl = accounts.find((a) => a.id === acct.accountId)?.target_cpl ?? null;
      for (const channel of ["website", "form"] as const) {
        const chAds = ads.filter((a) => a.leadChannel === channel);
        if (chAds.length === 0) continue;
        const sc = scoreAds(chAds, "leads", targetFor(channel, "leads", { cpl, cpa: null }));
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
  }, [data, accounts, hiddenAccounts]);

  // The account picked decides which lead source opens: a client that only runs
  // instant forms shouldn't land on an empty "website leads" list.
  const inAccount = useMemo(() => rows.filter((r) => account === ALL || r.accountId === account), [rows, account]);
  const channelSpend = (c: LeadChannel) => inAccount.filter((r) => r.channel === c).reduce((s, r) => s + r.ad.spend, 0);
  const channelCount = (c: LeadChannel) => inAccount.filter((r) => r.channel === c).length;
  const hasChannel = (c: LeadChannel) => channelCount(c) > 0;
  const derived: LeadChannel = channelSpend("form") > channelSpend("website") ? "form" : "website";
  const channel = channelPick && hasChannel(channelPick) ? channelPick : derived;

  // Blank or invalid input leaves the list unfiltered rather than matching nothing.
  const leadThreshold = leadOp !== "any" && leadCount.trim() !== "" && Number.isFinite(Number(leadCount))
    ? Math.max(0, Number(leadCount))
    : null;

  const listed = useMemo(
    () =>
      inAccount
        .filter((r) => r.channel === channel)
        // An ad that didn't deliver has no lead count to compare, not zero leads,
        // so it drops out whenever the filter is on.
        .filter((r) =>
          leadThreshold === null ||
          (r.ad.delivered && (leadOp === "gt" ? r.results > leadThreshold : r.results < leadThreshold)),
        )
        // Spent-most first; ads that are live but haven't delivered sit at the end,
        // where they read as "nothing to judge yet" rather than as the worst ads.
        .sort((a, b) => Number(b.ad.delivered) - Number(a.ad.delivered) || b.ad.spend - a.ad.spend),
    [inAccount, channel, leadOp, leadThreshold],
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

  return (
    <div className="space-y-4">
      {unreadable.length > 0 && (
        <SourceUnavailableNotice
          source="Meta Ads"
          stillLive="Every other client's creatives"
          message={`${unreadable.join(", ")}: the Meta token can't read ${unreadable.length === 1 ? "this ad account" : "these ad accounts"}. Assign them to the system user in Meta Business Settings.`}
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
          detail={`${totals.delivered} ${totals.delivered === 1 ? "ad" : "ads"} · ${totals.clients} ${totals.clients === 1 ? "client" : "clients"}`}
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
          <div className="flex items-center gap-1.5">
            <Select value={leadOp} onValueChange={(v) => setLeadOp(v as LeadOp)}>
              <SelectTrigger className="h-8 w-[140px] text-xs" aria-label={`Filter by ${LEAD_NOUN[channel].toLowerCase()}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(LEAD_OP_LABEL) as LeadOp[]).map((op) => (
                  <SelectItem key={op} value={op} className="text-xs">{LEAD_OP_LABEL[op]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {leadOp !== "any" && (
              <>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={leadCount}
                  onChange={(e) => setLeadCount(e.target.value)}
                  placeholder="0"
                  className="h-8 w-16 text-xs tabular-nums"
                  aria-label={`${LEAD_OP_LABEL[leadOp]} how many ${LEAD_NOUN[channel].toLowerCase()}`}
                />
                <span className="text-xs text-muted-foreground">{LEAD_NOUN[channel].toLowerCase()}</span>
              </>
            )}
          </div>
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

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Meta Ads · {periodCaption}
        {data && <> · updated {formatDistanceToNowStrict(new Date(data.fetchedAt), { addSuffix: true })}</>}
        {" · "}sorted by spend. {CHANNEL_LABEL[channel]} only: website and instant-form leads cost too
        differently to rank together, so one source shows at a time. Each ad is judged against its own
        client's CPL target (or that client's average when none is set), instant forms against that
        client's own form-lead average. Paused ads that spent in the period are listed and greyed.
      </p>

      {listed.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {rows.length === 0
            ? "No ads delivered in this period, and none are live."
            : leadThreshold !== null
              ? `No ads with ${LEAD_OP_LABEL[leadOp].toLowerCase()} ${formatCount(leadThreshold)} ${LEAD_NOUN[channel].toLowerCase()} in this period.`
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
            />
          ))}
        </ul>
      )}
    </div>
  );
}
