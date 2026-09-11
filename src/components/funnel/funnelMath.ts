// The post-click half of the funnel, from Meta's own counts: link clicks →
// landing page views → website leads → appointments, per landing page.
//
// Landing pages are compared on conversion rate (website leads ÷ landing page
// views) with a 95% Wilson interval each, and every page is tested against the
// leader (two-proportion z-test). A page is only "behind" when that difference
// is significant; otherwise the test is "not decided yet", with the traffic it
// still needs. Traffic isn't randomly split between pages (different ads feed
// them), so the UI names the ad sets behind each page.

import { normalizePageUrl, pagePath } from "@/lib/urls";
import { twoProportionPValue, wilsonInterval } from "@/lib/stats";
import { landingPageKey } from "@/components/creative-performance/breakdowns";
import type { CreativeAd } from "@/components/creative-performance/useCreativePerformance";

/** Below this many page views a conversion rate is too noisy to test. */
export const MIN_PAGE_VIEWS = 50;
const SIGNIFICANCE = 0.05;

export interface FunnelStep {
  key: "impressions" | "clicks" | "lpv" | "leads" | "appointments";
  label: string;
  value: number | null; // null = not tracked
  /** Conversion from the previous step, 0–1. Null for the first step or when either side is unknown. */
  rate: number | null;
  rateLabel: string | null;
}

export function funnelSteps(ads: CreativeAd[], appointmentsTracked: boolean): FunnelStep[] {
  const sum = (f: (a: CreativeAd) => number) => ads.reduce((s, a) => s + f(a), 0);
  const impressions = sum((a) => a.impressions);
  const clicks = sum((a) => a.linkClicks);
  const lpv = sum((a) => a.landingPageViews);
  const leads = sum((a) => a.webLeads);
  const appts = appointmentsTracked ? sum((a) => a.appointments ?? 0) : null;
  const rate = (n: number | null, d: number | null) => (n !== null && d !== null && d > 0 ? n / d : null);
  return [
    { key: "impressions", label: "Impressions", value: impressions, rate: null, rateLabel: null },
    { key: "clicks", label: "Link clicks", value: clicks, rate: rate(clicks, impressions), rateLabel: "Link CTR" },
    { key: "lpv", label: "Page views", value: lpv, rate: rate(lpv, clicks), rateLabel: "Page load rate" },
    { key: "leads", label: "Website leads", value: leads, rate: rate(leads, lpv), rateLabel: "Page conversion" },
    { key: "appointments", label: "Appts booked", value: appts, rate: rate(appts, leads), rateLabel: "Booking rate" },
  ];
}

export type PageStatus = "winner" | "leading" | "behind" | "undecided" | "needs_traffic" | "only_page" | "no_traffic" | "unreliable";

export interface PageTest {
  key: string;            // normalized URL
  url: string;            // as the ads (or the funnel repo) have it
  label: string;
  title: string | null;
  adCount: number;
  adsets: string[];
  spend: number;
  linkClicks: number;
  lpv: number;
  leads: number;
  appointments: number | null;
  loadRate: number | null;       // lpv ÷ link clicks
  cvr: number | null;            // leads ÷ lpv
  interval: { low: number; high: number } | null;
  costPerLead: number | null;
  bookingRate: number | null;    // appts ÷ leads
  status: PageStatus;
  pValue: number | null;         // vs the leader
  /** Extra page views needed before a difference this size could be called. */
  viewsNeeded: number | null;
}

export interface FunnelPage {
  url: string;
  label: string;
  page_title: string | null;
}

// Booking and thank-you pages are funnel steps, not pages an ad should land on.
const isEntryPage = (url: string) => !/schedule|calendar|booking|thank/i.test(url);

/**
 * Rough per-page sample size for 80% power at 95% confidence to tell rates p1
 * and p2 apart (normal approximation). Null when the rates are equal.
 */
function sampleSizePerPage(p1: number, p2: number): number | null {
  const diff = Math.abs(p1 - p2);
  if (diff === 0) return null;
  const pbar = (p1 + p2) / 2;
  return Math.ceil(((1.96 + 0.84) ** 2 * 2 * pbar * (1 - pbar)) / diff ** 2);
}

export function analyzeLandingPages(
  websiteAds: CreativeAd[],
  funnelPages: FunnelPage[],
  appointmentsTracked: boolean,
): PageTest[] {
  const known = new Map(funnelPages.map((p) => [normalizePageUrl(p.url), p]));
  const groups = new Map<string, CreativeAd[]>();
  for (const ad of websiteAds) {
    if (!ad.delivered || ad.spend <= 0) continue;
    const key = landingPageKey(ad);
    if (key.startsWith("__")) continue; // no page, or several Meta didn't split
    groups.set(key, [...(groups.get(key) ?? []), ad]);
  }

  const rows: PageTest[] = [...groups.entries()].map(([key, ads]) => {
    const sum = (f: (a: CreativeAd) => number) => ads.reduce((s, a) => s + f(a), 0);
    const page = known.get(key);
    const lpv = sum((a) => a.landingPageViews);
    const leads = sum((a) => a.webLeads);
    const clicks = sum((a) => a.linkClicks);
    const spend = sum((a) => a.spend);
    const appointments = appointmentsTracked ? sum((a) => a.appointments ?? 0) : null;
    // More leads than page views means Meta is undercounting views (or Lead fires
    // off the page too); a "rate" over 100% would be fiction, so it isn't tested.
    const unreliable = leads > lpv;
    return {
      key,
      url: page?.url ?? ads[0].copy.destinationUrls[0],
      label: page?.label ?? pagePath(key),
      title: page?.page_title ?? null,
      adCount: ads.length,
      adsets: [...new Set(ads.map((a) => a.adset).filter((s): s is string => !!s))],
      spend,
      linkClicks: clicks,
      lpv,
      leads,
      appointments,
      loadRate: clicks > 0 ? lpv / clicks : null,
      cvr: lpv > 0 && !unreliable ? leads / lpv : null,
      interval: unreliable ? null : wilsonInterval(leads, lpv),
      costPerLead: leads > 0 ? spend / leads : null,
      bookingRate: appointments !== null && leads > 0 ? appointments / leads : null,
      status: unreliable ? "unreliable" : lpv < MIN_PAGE_VIEWS ? "needs_traffic" : "undecided",
      pValue: null,
      viewsNeeded: null,
    };
  });

  const eligible = rows.filter((r) => r.status === "undecided");
  if (eligible.length === 1 && rows.length === 1) {
    eligible[0].status = "only_page";
  } else if (eligible.length >= 2) {
    const leader = eligible.reduce((a, b) => ((b.cvr ?? 0) > (a.cvr ?? 0) ? b : a));
    for (const r of eligible) {
      if (r === leader) continue;
      r.pValue = twoProportionPValue(leader.leads, leader.lpv, r.leads, r.lpv);
      if (r.pValue !== null && r.pValue < SIGNIFICANCE) {
        r.status = "behind";
      } else {
        const n = sampleSizePerPage(leader.cvr ?? 0, r.cvr ?? 0);
        r.viewsNeeded = n !== null ? Math.max(0, n - Math.min(r.lpv, leader.lpv)) : null;
      }
    }
    leader.status = eligible.every((r) => r === leader || r.status === "behind") ? "winner" : "leading";
  } else if (eligible.length === 1) {
    eligible[0].status = "leading";
  }

  // Live entry pages no ad sends traffic to: an idle variant is a test that isn't running.
  for (const [key, page] of known) {
    if (groups.has(key) || !isEntryPage(page.url)) continue;
    rows.push({
      key,
      url: page.url,
      label: page.label,
      title: page.page_title,
      adCount: 0,
      adsets: [],
      spend: 0,
      linkClicks: 0,
      lpv: 0,
      leads: 0,
      appointments: null,
      loadRate: null,
      cvr: null,
      interval: null,
      costPerLead: null,
      bookingRate: null,
      status: "no_traffic",
      pValue: null,
      viewsNeeded: null,
    });
  }

  const order: Record<PageStatus, number> = { winner: 0, leading: 1, only_page: 1, undecided: 2, behind: 3, needs_traffic: 4, unreliable: 5, no_traffic: 6 };
  return rows.sort((a, b) => order[a.status] - order[b.status] || b.lpv - a.lpv);
}
