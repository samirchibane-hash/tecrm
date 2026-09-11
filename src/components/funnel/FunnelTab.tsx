import { useMemo } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceUnavailableNotice } from "@/components/dashboard/SourceUnavailableNotice";
import { FunnelPagesCard } from "@/components/funnel-pages/FunnelPagesCard";
import { useAccountLinks } from "@/components/funnel-pages/useAccountLinks";
import { useCreativePerformance } from "@/components/creative-performance/useCreativePerformance";
import { adNameKey, matchGhlByAdName } from "@/components/creative-performance/ghl";
import { useAccountGhlConversions } from "@/hooks/useAccountGhlConversions";
import { formatCount, formatUsd } from "@/lib/format";
import { periodText, type MetaPreset } from "@/lib/periods";
import { FunnelSteps } from "./FunnelSteps";
import { LandingPageTest } from "./LandingPageTest";
import { analyzeLandingPages, funnelSteps } from "./funnelMath";

/**
 * The post-click funnel for one account: where people drop between the click
 * and the booked water test, and which landing page converts best. Same Meta
 * data (and cache) as the Performance tab.
 */
export function FunnelTab({ accountId, accountName, preset }: { accountId: string; accountName: string; preset: MetaPreset }) {
  const range = useMemo(() => ({ preset }), [preset]);
  const { data, isLoading, isError, error, refetch, isFetching } = useCreativePerformance(accountId, range);
  const { data: links = [] } = useAccountLinks(accountName);
  const { data: ghlRows = [] } = useAccountGhlConversions(accountId);

  const apptsTracked = !!data?.appointmentsTracked;
  const websiteAds = useMemo(() => (data?.ads ?? []).filter((a) => a.leadChannel === "website" && a.delivered), [data]);
  const formAds = useMemo(() => (data?.ads ?? []).filter((a) => a.leadChannel === "form" && a.delivered && a.spend > 0), [data]);
  const steps = useMemo(() => funnelSteps(websiteAds, apptsTracked), [websiteAds, apptsTracked]);
  const pages = useMemo(
    () => analyzeLandingPages(websiteAds, links.filter((l) => l.source === "funnel_repo"), apptsTracked),
    [websiteAds, links, apptsTracked],
  );
  const crm = useMemo(() => {
    if (!data?.period) return null;
    const m = matchGhlByAdName(ghlRows, data.period.since, data.period.until);
    const names = new Set(websiteAds.map((a) => adNameKey(a.name)));
    const leads = [...names].reduce((s, n) => s + (m.byName.get(n)?.leads ?? 0), 0);
    return { leads, ...m };
  }, [ghlRows, data?.period, websiteAds]);

  const form = formAds.reduce((acc, a) => ({ spend: acc.spend + a.spend, leads: acc.leads + a.formLeads, clicks: acc.clicks + a.linkClicks }), { spend: 0, leads: 0, clicks: 0 });

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="funnel-heading">
        <div>
          <h2 id="funnel-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Website funnel</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data?.adAccount
              ? [
                  `Meta Ads · ${data.adAccount.name}`,
                  data.period ? periodText(data.period.since, data.period.until) : null,
                  `updated ${formatDistanceToNowStrict(new Date(data.fetchedAt), { addSuffix: true })}`,
                ].filter(Boolean).join(" · ")
              : "Meta Ads"}
          </p>
        </div>

        {isLoading || !accountId ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
              {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[84px] rounded-xl" />)}
            </div>
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : isError ? (
          <SourceUnavailableNotice source="Meta Ads" message={(error as Error).message} onRetry={() => refetch()} retrying={isFetching} />
        ) : !data?.adAccount ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            This client has no Meta ad account on file, so there's no funnel data to show.
          </p>
        ) : websiteAds.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No website ads delivered in this period{formAds.length > 0 ? ": this account ran instant forms only" : ""}.
          </p>
        ) : (
          <>
            <FunnelSteps steps={steps} />
            <p className="text-[11px] text-muted-foreground">
              Website ads only.
              {crm && crm.leads > 0 && (
                <> GHL recorded {formatCount(crm.leads)} leads from these ads (matched by ad name; {crm.withAdName} of {crm.total} GHL leads in the period carry one).</>
              )}
              {crm && crm.leads === 0 && crm.total > 0 && (
                <> None of the {crm.total} GHL leads in this period carry a website ad's name, so the CRM can't confirm which ads they came from: pass utm_content through to GHL.</>
              )}
              {form.spend > 0 && (
                <> Instant forms, for comparison: {formatCount(form.leads)} form leads from {formatCount(form.clicks)} clicks on {formatUsd(form.spend)}
                  {form.leads > 0 && <> ({formatUsd(form.spend / form.leads)} per lead)</>}.</>
              )}
            </p>
            <LandingPageTest pages={pages} appointmentsTracked={apptsTracked} />
          </>
        )}
      </section>

      <FunnelPagesCard accountId={accountId} accountName={accountName} />
    </div>
  );
}
