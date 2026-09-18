// The cross-client funnel scorecard: every landing page every client's website
// ads sent traffic to in the period, judged, plus what the winning pages have
// in common.
//
// Two different questions, two different tests, because conflating them is how
// a good page with expensive traffic gets killed:
//
//   Money   — cost per website lead, tested against that client's own CPL
//             benchmark (accounts.target_cpl, else their own average) with the
//             same Poisson verdict the creative scorecard uses. This is what
//             "top performer" and "money waster" mean here, and it's the only
//             number that carries dollars.
//   Page    — conversion rate (website leads ÷ landing page views) with a 95%
//             Wilson interval. This isolates the page from its traffic: a page
//             can convert brilliantly on clicks that cost too much.
//
// Headlines and offers are the biggest lever a landing page has, so they're
// also rolled up across clients: pages sharing a headline (the funnels are
// built from shared templates, so they genuinely recur) or an offer are pooled
// and compared on conversion rate. That pooling crosses markets and traffic
// sources, so it's a signal to test, never a verdict — the UI says so.

import { landingPageKey } from "@/components/creative-performance/breakdowns";
import { OFFER_LABEL, type AngleKey, type OfferKey } from "@/components/creative-performance/labels";
import type { CreativeAd, PortfolioAccount } from "@/components/creative-performance/useCreativePerformance";
import { computeBenchmark, isTrackingGap, judge, type Benchmark, type Judgement } from "@/components/creative-performance/verdicts";
import { twoProportionPValue, wilsonInterval } from "@/lib/stats";
import { normalizePageUrl, pagePath } from "@/lib/urls";
import { detectPageCopy } from "./funnelMath";

/** Below this many pooled page views a headline's or offer's rate is too noisy to rank. */
export const MIN_GROUP_VIEWS = 200;
const SIGNIFICANCE = 0.05;

/** One synced funnel page, with the copy github-sync lifted off its HTML. */
export interface FunnelPageCopy {
  account_name: string;
  url: string;
  label: string;
  page_title: string | null;
  page_headline: string | null;
  page_subhead: string | null;
  page_cta: string | null;
  copy_synced_at: string | null;
}

export interface PortfolioPage extends Judgement {
  key: string;             // normalized URL
  accountId: string;
  accountName: string;
  url: string;
  label: string;
  /** The page's own hero headline, from the funnel repo. Null when the page isn't synced. */
  headline: string | null;
  offer: OfferKey | null;  // null when there's no page copy to read it from
  angle: AngleKey | null;
  /** What the page promises, for the tooltip: headline + subhead + form card line. */
  copy: string | null;
  adCount: number;
  adsets: string[];
  spend: number;
  linkClicks: number;
  lpv: number;
  leads: number;
  cvr: number | null;
  interval: { low: number; high: number } | null;
  benchmark: Benchmark | null;
}

/** A headline or an offer, pooled across every page that uses it. */
export interface CopyGroup {
  key: string;
  label: string;
  pages: number;
  clients: string[];
  spend: number;
  lpv: number;
  leads: number;
  cvr: number | null;
  interval: { low: number; high: number } | null;
  costPerLead: number | null;
  /** Compared with the best-converting group that has enough views. */
  status: "best" | "behind" | "even" | "needs_traffic";
  pValue: number | null;
}

export interface PortfolioFunnel {
  pages: PortfolioPage[];
  winners: PortfolioPage[];
  wasters: PortfolioPage[];
  headlines: CopyGroup[];
  offers: CopyGroup[];
  /** Clients whose website ads spent with no lead recorded anywhere: not judged. */
  gaps: { accountName: string; spend: number }[];
  /** Clients Meta refused outright. */
  unreadable: string[];
  /** Pages with ad traffic whose copy hasn't been synced, so they carry no headline. */
  unsynced: number;
  clients: number;
  spend: number;
  lpv: number;
  leads: number;
  excess: number;
  savings: number;
  /** Website leads ÷ page views across every judged page. */
  portfolioCvr: number | null;
}

export interface FunnelAccountInfo {
  id: string;
  account_name: string;
  target_cpl: number | null;
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

/**
 * The same headline written for two markets is the same headline: casing,
 * punctuation and "&" vs "and" vary, the promise doesn't. Numbers stay —
 * "$3,495" is the headline's whole point, so it must never normalize away.
 */
export function headlineKey(headline: string): string {
  return collapse(headline)
    .toLowerCase()
    .replace(/[‘’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9$. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rate(leads: number, lpv: number) {
  // More leads than page views means Meta is undercounting views (or Lead fires
  // off the page); a rate over 100% would be fiction, so none is shown.
  if (lpv <= 0 || leads > lpv) return { cvr: null, interval: null };
  return { cvr: leads / lpv, interval: wilsonInterval(leads, lpv) };
}

/** Rank groups on conversion rate and test each against the leader. */
function rankGroups(groups: CopyGroup[]): CopyGroup[] {
  const eligible = groups.filter((g) => g.lpv >= MIN_GROUP_VIEWS && g.cvr !== null);
  for (const g of groups) g.status = g.lpv >= MIN_GROUP_VIEWS && g.cvr !== null ? "even" : "needs_traffic";
  if (eligible.length > 0) {
    const leader = eligible.reduce((a, b) => (b.cvr! > a.cvr! ? b : a));
    leader.status = "best";
    for (const g of eligible) {
      if (g === leader) continue;
      g.pValue = twoProportionPValue(leader.leads, leader.lpv, g.leads, g.lpv);
      if (g.pValue !== null && g.pValue < SIGNIFICANCE) g.status = "behind";
    }
  }
  const order = { best: 0, even: 1, behind: 2, needs_traffic: 3 } as const;
  return groups.sort((a, b) => order[a.status] - order[b.status] || (b.cvr ?? -1) - (a.cvr ?? -1));
}

function groupPages(
  pages: PortfolioPage[],
  keyOf: (p: PortfolioPage) => string | null,
  labelOf: (p: PortfolioPage) => string,
): CopyGroup[] {
  const buckets = new Map<string, PortfolioPage[]>();
  for (const p of pages) {
    const key = keyOf(p);
    if (key === null) continue;
    buckets.set(key, [...(buckets.get(key) ?? []), p]);
  }
  const groups = [...buckets.entries()].map(([key, rows]): CopyGroup => {
    const lpv = sum(rows, (r) => r.lpv);
    const leads = sum(rows, (r) => r.leads);
    const spend = sum(rows, (r) => r.spend);
    return {
      key,
      label: labelOf(rows[0]),
      pages: rows.length,
      clients: [...new Set(rows.map((r) => r.accountName))],
      spend,
      lpv,
      leads,
      costPerLead: leads > 0 ? spend / leads : null,
      status: "needs_traffic",
      pValue: null,
      ...rate(leads, lpv),
    };
  });
  return rankGroups(groups);
}

/**
 * Every client's landing pages for one period. `accounts` carries the CPL
 * targets, `links` the synced page copy, `hidden` the clients kept off the
 * dashboard.
 */
export function analyzePortfolioFunnel(
  portfolio: PortfolioAccount[],
  accounts: FunnelAccountInfo[],
  links: FunnelPageCopy[],
  hidden: string[],
): PortfolioFunnel {
  const copyByAccount = new Map<string, Map<string, FunnelPageCopy>>();
  for (const l of links) {
    const forAccount = copyByAccount.get(l.account_name) ?? new Map<string, FunnelPageCopy>();
    forAccount.set(normalizePageUrl(l.url), l);
    copyByAccount.set(l.account_name, forAccount);
  }

  const pages: PortfolioPage[] = [];
  const gaps: PortfolioFunnel["gaps"] = [];
  const unreadable: string[] = [];
  const clients = new Set<string>();
  let unsynced = 0;

  for (const acct of portfolio) {
    if (hidden.includes(acct.accountName)) continue;
    if (acct.error) {
      unreadable.push(acct.accountName);
      continue;
    }
    // Website ads only: instant forms never touch a landing page, and their
    // leads are never summed with website leads.
    const websiteAds = (acct.ads ?? []).filter((a) => a.leadChannel === "website" && a.delivered && a.spend > 0);
    if (websiteAds.length === 0) continue;

    const target = accounts.find((a) => a.id === acct.accountId)?.target_cpl ?? null;
    const benchmark = computeBenchmark(websiteAds, "leads", target);
    const trackingGap = isTrackingGap(websiteAds, "leads", benchmark);
    if (trackingGap) gaps.push({ accountName: acct.accountName, spend: sum(websiteAds, (a) => a.spend) });

    const byPage = new Map<string, CreativeAd[]>();
    for (const ad of websiteAds) {
      const key = landingPageKey(ad);
      if (key.startsWith("__")) continue; // no page, or several Meta didn't split
      byPage.set(key, [...(byPage.get(key) ?? []), ad]);
    }
    if (byPage.size > 0) clients.add(acct.accountName);

    for (const [key, ads] of byPage) {
      const synced = copyByAccount.get(acct.accountName)?.get(key);
      const copy = detectPageCopy(synced);
      if (!copy.copy) unsynced += 1;
      const spend = sum(ads, (a) => a.spend);
      const leads = sum(ads, (a) => a.webLeads);
      const lpv = sum(ads, (a) => a.landingPageViews);
      pages.push({
        key,
        accountId: acct.accountId,
        accountName: acct.accountName,
        url: synced?.url ?? ads[0].copy.destinationUrls[0],
        label: synced?.label ?? pagePath(key),
        ...copy,
        adCount: ads.length,
        adsets: [...new Set(ads.map((a) => a.adset).filter((s): s is string => !!s))],
        spend,
        linkClicks: sum(ads, (a) => a.linkClicks),
        lpv,
        leads,
        benchmark,
        ...rate(leads, lpv),
        ...judge({ spend, results: leads }, benchmark, "leads", { trackingGap }),
      });
    }
  }

  // Live first on both lists: a paused page isn't a thing, but a page whose ads
  // all stopped can't be scaled today either, so order by size of the prize.
  const winners = pages.filter((p) => p.verdict === "winner").sort((a, b) => b.savings - a.savings);
  const wasters = pages.filter((p) => p.verdict === "waster").sort((a, b) => b.excessSpend - a.excessSpend);

  // Only pages with synced copy can be grouped by what they say.
  const withCopy = pages.filter((p) => p.copy !== null);
  const lpv = sum(pages, (p) => p.lpv);
  const leads = sum(pages, (p) => p.leads);

  return {
    pages: pages.sort((a, b) => b.spend - a.spend),
    winners,
    wasters,
    headlines: groupPages(
      withCopy,
      (p) => (p.headline ? headlineKey(p.headline) : null),
      (p) => p.headline!,
    ),
    offers: groupPages(
      withCopy,
      (p) => p.offer,
      (p) => OFFER_LABEL[p.offer!],
    ),
    gaps,
    unreadable,
    unsynced,
    clients: clients.size,
    spend: sum(pages, (p) => p.spend),
    lpv,
    leads,
    excess: sum(wasters, (p) => p.excessSpend),
    savings: sum(winners, (p) => p.savings),
    portfolioCvr: rate(leads, lpv).cvr,
  };
}
