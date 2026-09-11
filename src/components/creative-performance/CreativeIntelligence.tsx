import { useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, DollarSign, OctagonX, RefreshCw, Target, TrendingUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiStatCard } from "@/components/dashboard/KpiStatCard";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { SegmentedControl } from "@/components/SegmentedControl";
import { useAccountLinks } from "@/components/funnel-pages/useAccountLinks";
import { useAccountGhlConversions } from "@/hooks/useAccountGhlConversions";
import { formatCount, formatUsd } from "@/lib/format";
import { periodText, type MetaPreset } from "@/lib/periods";
import { normalizePageUrl, pagePath } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { ActionBoard } from "./ActionBoard";
import { BreakdownPanel } from "./BreakdownPanel";
import { CreativeLeaderboard } from "./CreativeLeaderboard";
import { adNameKey, matchGhlByAdName } from "./ghl";
import { labelCreative } from "./labels";
import { useCreativeLabels } from "./useCreativeLabels";
import { useCreativePerformance, type LeadChannel } from "./useCreativePerformance";
import { benchmarkText, dominantChannel, METRIC_NOUN, scoreAds, targetFor, type Metric } from "./verdicts";

export interface AccountTargets {
  cpl: number | null;
  cpa: number | null;
}

const CHANNEL_LABEL: Record<LeadChannel, string> = { website: "Website leads", form: "Instant-form leads" };

/**
 * The account page's creative intelligence: which ads to scale, which are
 * wasting money, what's fatiguing, and which offers, angles, headlines and
 * primary texts are carrying the account. Live from Meta, one lead source at a
 * time (website and instant-form leads differ too much in cost and quality to
 * rank together), judged against the account's target or its own average.
 */
export function CreativeIntelligence({
  accountId,
  accountName,
  preset,
  targets,
}: {
  accountId: string;
  accountName: string;
  preset: MetaPreset;
  targets: AccountTargets;
}) {
  const range = useMemo(() => ({ preset }), [preset]);
  const { data, isLoading, isError, error, refetch, isFetching } = useCreativePerformance(accountId, range);
  const { overrides, save } = useCreativeLabels(accountId);
  const { data: ghlRows = [] } = useAccountGhlConversions(accountId);
  const { data: links = [] } = useAccountLinks(accountName);
  const [channelPick, setChannel] = useState<LeadChannel | null>(null);
  const [metricPick, setMetric] = useState<Metric>("leads");

  const ads = useMemo(() => data?.ads ?? [], [data]);
  const channelSpend = (c: LeadChannel) => ads.filter((a) => a.leadChannel === c).reduce((s, a) => s + a.spend, 0);
  const bothChannels = channelSpend("website") > 0 && channelSpend("form") > 0;
  const channel = channelPick ?? dominantChannel(ads);
  const apptsTracked = !!data?.appointmentsTracked;
  const metric: Metric = metricPick === "appointments" && apptsTracked && channel === "website" ? "appointments" : "leads";
  const noun = METRIC_NOUN[metric];
  const target = targetFor(channel, metric, targets);

  const channelAds = useMemo(() => ads.filter((a) => a.leadChannel === channel), [ads, channel]);
  const scorecard = useMemo(() => scoreAds(channelAds, metric, target), [channelAds, metric, target]);
  const labels = useMemo(
    () => new Map(ads.map((a) => [a.id, labelCreative(a, overrides.get(adNameKey(a.name)))])),
    [ads, overrides],
  );
  const ghl = useMemo(
    () => (data?.period ? matchGhlByAdName(ghlRows, data.period.since, data.period.until) : null),
    [ghlRows, data?.period],
  );
  const crmMatched = !!ghl && channelAds.some((a) => (ghl.byName.get(adNameKey(a.name))?.leads ?? 0) > 0);
  const ctx = useMemo(() => {
    const pageLabels = new Map(links.map((l) => [normalizePageUrl(l.url), l.label]));
    return { metric, labels, assets: data?.assets ?? null, pageLabel: (k: string) => pageLabels.get(k) ?? pagePath(k) };
  }, [metric, labels, data?.assets, links]);

  const results = scorecard.scored.reduce((s, x) => s + (x.ad.delivered ? x.results : 0), 0);
  const winnerSpend = scorecard.winners.reduce((s, w) => s + w.ad.spend, 0);
  const pct = (n: number) => (scorecard.spend > 0 ? `${Math.round((n / scorecard.spend) * 100)}% of spend` : "");
  const delivered = channelAds.filter((a) => a.delivered && a.spend > 0).length;

  const caption = data?.adAccount
    ? [
        `Meta Ads · ${data.adAccount.name}`,
        data.period ? periodText(data.period.since, data.period.until) : null,
        `updated ${formatDistanceToNowStrict(new Date(data.fetchedAt), { addSuffix: true })}`,
      ].filter(Boolean).join(" · ")
    : "Meta Ads";

  return (
    <section className="space-y-5" aria-labelledby="creative-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="creative-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Creative performance</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {bothChannels && (
            <SegmentedControl
              value={channel}
              onChange={(c) => setChannel(c)}
              label="Lead source"
              options={[
                { value: "website", label: "Website leads" },
                { value: "form", label: "Instant forms" },
              ]}
            />
          )}
          {apptsTracked && channel === "website" && (
            <SegmentedControl
              value={metric}
              onChange={setMetric}
              label="Judge creatives on"
              options={[
                { value: "leads", label: "Cost / lead" },
                { value: "appointments", label: "Cost / appt" },
              ]}
            />
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
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[62px] rounded-xl" />)}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14 rounded-md" />)}
        </div>
      ) : isError ? (
        <SourceUnavailableNotice source="Meta Ads" message={(error as Error).message} onRetry={() => refetch()} retrying={isFetching} />
      ) : !data?.adAccount ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          This client has no Meta ad account on file, so there are no creatives to analyse. It's linked during client onboarding.
        </p>
      ) : ads.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No ads delivered in {data.adAccount.name} in this period, and none are live.
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{CHANNEL_LABEL[channel]}</span>
            {" · "}
            {scorecard.benchmark ? (
              <>Benchmark {benchmarkText(scorecard.benchmark, metric)}</>
            ) : (
              <>No benchmark yet: set a target {metric === "appointments" ? "cost per appointment" : "CPL"} to judge creatives</>
            )}
            {scorecard.benchmark?.source === "average" && (
              <> ({channel === "form" && metric === "leads" ? "instant-form leads are judged against their own average, not the website CPL target" : "no target set"})</>
            )}
            {bothChannels && (
              <> · {CHANNEL_LABEL[channel === "website" ? "form" : "website"]} are scored separately: switch above</>
            )}
          </p>

          {scorecard.trackingGap && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertTitle className="text-sm">No {noun.many} recorded on any ad</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                {formatUsd(scorecard.spend)} of spend produced zero {CHANNEL_LABEL[channel].toLowerCase()}
                {metric === "appointments" ? " appointments" : ""} in Meta. That's the signature of a broken
                event, not bad creative, so no ad is marked a money waster until the funnel's {metric === "appointments" ? "Schedule" : "Lead"} event is checked.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <KpiStatCard
              label="Spend"
              value={formatUsd(scorecard.spend)}
              icon={DollarSign}
              detail={`${delivered} ${channel === "form" ? "form" : "website"} ${delivered === 1 ? "ad" : "ads"} delivered`}
            />
            <KpiStatCard
              label={metric === "appointments" ? "Appts (Meta)" : channel === "form" ? "Form leads" : "Website leads"}
              value={formatCount(results)}
              icon={Target}
              detail={results > 0 ? `${formatUsd(scorecard.spend / results, { decimals: true })} per ${noun.one}` : `No ${noun.many} in period`}
            />
            <KpiStatCard
              label="Money wasters"
              value={formatUsd(scorecard.wasterSpend)}
              icon={OctagonX}
              unavailable={scorecard.trackingGap || !scorecard.benchmark}
              unavailableReason={scorecard.trackingGap ? "Withheld: check tracking" : "No benchmark"}
              detail={`${scorecard.wasters.length} ${scorecard.wasters.length === 1 ? "ad" : "ads"} · ${pct(scorecard.wasterSpend)}`}
            />
            <KpiStatCard
              label="Winners"
              value={formatUsd(winnerSpend)}
              icon={TrendingUp}
              unavailable={scorecard.trackingGap || !scorecard.benchmark}
              unavailableReason={scorecard.trackingGap ? "Withheld: check tracking" : "No benchmark"}
              detail={`${scorecard.winners.length} ${scorecard.winners.length === 1 ? "ad" : "ads"} · ${pct(winnerSpend)}`}
            />
          </div>

          <ActionBoard scorecard={scorecard} metric={metric} />

          <BreakdownPanel
            ads={channelAds}
            ctx={ctx}
            benchmark={scorecard.benchmark}
            trackingGap={scorecard.trackingGap}
            appointmentsTracked={apptsTracked && channel === "website"}
          />

          <CreativeLeaderboard
            scored={scorecard.scored}
            labels={labels}
            ghl={ghl}
            metric={metric}
            appointmentsTracked={apptsTracked && channel === "website"}
            savingLabel={save.isPending}
            onSaveLabel={(adName, offer, angle) => save.mutate({ adName, offer, angle })}
          />

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Verdicts compare what each ad's spend should have bought at the benchmark with what it did. Winner and Money
            waster are only called at 90% confidence and a material gap (15% under, or 25% over or zero), so an ad with
            little spend reads Too early rather than being guessed at. Website leads are the pixel's Lead event; instant-form
            leads are scored separately. {apptsTracked && "Appts are Meta Schedule events credited to each ad. "}
            {ghl && crmMatched && (
              <>CRM leads are GHL contacts matched by ad name: {ghl.withAdName} of {ghl.total} GHL leads in this period carry one. </>
            )}
            {ghl && !crmMatched && ghl.total > 0 && (
              <>
                None of the {ghl.total} GHL leads in this period carry the name of one of these ads, so CRM leads can't be tied to
                {channel === "website" ? " website" : " instant-form"} creatives: the funnel isn't passing utm_content (the ad name) into GHL.{" "}
              </>
            )}
            Includes paused ads that spent in the period; greyed rows are no longer live.
          </p>
        </>
      )}
    </section>
  );
}
