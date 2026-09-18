// The cross-client funnel scorecard: every landing page every client's website
// ads sent traffic to in the period, judged, plus what the winning pages have
// in common.
//
// Two different questions, two different tests, because conflating them is how
// a good page with expensive traffic gets killed:
//
//   Money   — cost per website lead, indexed to that client's own CPL benchmark
//             (accounts.target_cpl, else their own average). The index is what
//             orders the single ranked list: a $40 lead is cheap in one market
//             and dear in another, so raw cost can't rank across clients. The
//             same Poisson verdict the creative scorecard uses then says whether
//             the gap is big enough to act on — ranking is order, not proof.
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
import { adNameKey, type GhlConversionLite } from "@/components/creative-performance/ghl";
import { OFFER_LABEL, type AngleKey, type OfferKey } from "@/components/creative-performance/labels";
import type { CreativeAd, PortfolioAccount } from "@/components/creative-performance/useCreativePerformance";
import { computeBenchmark, isTrackingGap, judge, type Benchmark, type Judgement, type Verdict } from "@/components/creative-performance/verdicts";
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

/**
 * One copy version of a page: what it said, and the window it said it for.
 * `validTo` null means this is the version serving now.
 */
export interface FunnelPageVersion {
  url: string;
  version: number;
  /** Split-test arm. "a" for an ordinary sequential rewrite. */
  variant: string;
  page_headline: string | null;
  valid_from: string;
  valid_to: string | null;
}

/**
 * Which copy version earned this page's numbers — and whether it's only one.
 * A period that straddles a rewrite reports two different pages as one, so the
 * scorecard has to say so rather than pin the whole rate on today's headline.
 */
export interface PageCopyVersion {
  /** Version live at the end of the period. Null when the page has no history yet. */
  version: number | null;
  /** When that version went live, or was first observed — see `sinceIsFirstSeen`. */
  since: string | null;
  /**
   * True when `since` is only the first time the sync read this copy, not the day
   * it went live. Always true for a page's earliest version, because history
   * starts when the sync starts. The UI must say "first seen", never "live since".
   */
  sinceIsFirstSeen: boolean;
  /** Versions with any life inside the period — more than one means mixed numbers. */
  spanned: number;
  /** The headline the *previous* version showed, when the period straddles the change. */
  previousHeadline: string | null;
}

/**
 * One version of a page, with the figures it earned on its own. This is the
 * unit a copy test is actually about: v1 is off, v2 is live, and each carries
 * what it did while it was up, never a blended number across both.
 */
export interface PageVersionRow {
  version: number;
  headline: string | null;
  /** "live" = serving now. "off" = replaced; its numbers are final. */
  status: "live" | "off";
  /** Days inside the period this version was live for. */
  days: number;
  spend: number;
  lpv: number;
  leads: number;
  cvr: number | null;
  interval: { low: number; high: number } | null;
  costPerLead: number | null;
  /**
   * The day a version changed is split between two versions and Meta reports no
   * finer than a day, so that day's figures sit with whichever version held most
   * of it. True here means this version owns such a day: its totals are within
   * one day's traffic of exact.
   */
  hasSplitDay: boolean;
}

export interface PortfolioPage extends Judgement, PageCopyVersion {
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
  /** Normalized names of the ads pointing here, for matching CRM leads by utm_content. */
  adNames: string[];
  spend: number;
  linkClicks: number;
  lpv: number;
  leads: number;
  cvr: number | null;
  interval: { low: number; high: number } | null;
  benchmark: Benchmark | null;
  /**
   * Cost per lead ÷ this client's benchmark: 0.6 is 40% cheaper than the client
   * needs, 1.8 is 80% dearer. Dividing by each client's own benchmark is what
   * makes one ranked list across clients honest — a $40 lead is good in one
   * market and bad in another. Null when the page has no leads or no benchmark.
   */
  benchmarkIndex: number | null;
  /**
   * Leads the CRM holds for this page, from GoHighLevel rather than Meta. Kept
   * in its own field and never added to `leads`: one is what an ad produced,
   * the other is what landed in the CRM from any source (design rule #5).
   */
  crmLeads: number;
  /**
   * True when those CRM leads carry no ad name and were attributed to this page
   * only because it is the client's single page with ad traffic. A reasonable
   * inference, not a measurement — the UI has to say so.
   */
  crmInferred: boolean;
  /**
   * This page's versions, newest first, each with its own figures. Empty when
   * the page has no copy history, or when day-level rows weren't fetched — in
   * which case the UI shows the blended row alone rather than guessing a split.
   */
  versionRows: PageVersionRow[];
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
  /**
   * Pages in this group whose copy changed mid-period, so part of these views
   * were earned by a headline that is not the one named here. Any number above
   * zero makes the row indicative only.
   */
  mixedPages: number;
}

export interface PortfolioFunnel {
  pages: PortfolioPage[];
  /**
   * The rows the ranked list renders: one per page, or one per copy version
   * where a page was rewritten inside the period.
   */
  ranked: RankedEntry[];
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
  /**
   * Pages whose copy changed inside the period, so their figures were earned by
   * more than one version. The board says so rather than crediting today's copy.
   */
  mixedCopyPages: number;
  /** CRM leads no page could be attributed to: no ad name, and the client runs several pages. */
  crmUnallocated: number;
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

/**
 * Which copy version was live when this page earned its numbers.
 *
 * A version counts as "spanned" when its own life overlaps the reporting
 * window at all, so two or more means the period mixes headlines. With no
 * period bounds (nothing to straddle) or no history for the page, the answer
 * is a single unknown version rather than a false "one version" claim.
 */
export function resolveCopyVersion(
  versions: FunnelPageVersion[],
  since: string | undefined,
  until: string | undefined,
): PageCopyVersion {
  const none = { version: null, since: null, sinceIsFirstSeen: false, spanned: 0, previousHeadline: null };
  if (versions.length === 0) return none;

  const ordered = [...versions].sort((a, b) => a.valid_from.localeCompare(b.valid_from));
  const live = ordered[ordered.length - 1];
  const firstSeen = (v: FunnelPageVersion) => v === ordered[0];

  if (!since || !until) {
    return {
      version: live.version,
      since: live.valid_from,
      sinceIsFirstSeen: firstSeen(live),
      spanned: 1,
      previousHeadline: null,
    };
  }

  // Meta's `until` is a date; a version opened that day still overlaps it.
  const end = `${until}T23:59:59.999Z`;
  // The earliest version we hold reaches back indefinitely: history begins when
  // the sync began, not when the page did, so its recorded `valid_from` is a
  // first sighting. Treating it as a start date would hand its traffic to the
  // version that replaced it — the exact misattribution this exists to stop.
  const startOf = (v: FunnelPageVersion) => (firstSeen(v) ? "" : v.valid_from);
  const overlapping = ordered.filter((v) => startOf(v) <= end && (v.valid_to === null || v.valid_to >= since));
  const current = overlapping[overlapping.length - 1] ?? ordered[0];
  const prior = overlapping.length > 1 ? overlapping[overlapping.length - 2] : null;

  return {
    version: current.version,
    since: current.valid_from,
    sinceIsFirstSeen: firstSeen(current),
    spanned: overlapping.length,
    previousHeadline: prior?.page_headline ?? null,
  };
}

/**
 * The version live for the greater part of a given day.
 *
 * Meta reports no finer than a day, so a day containing a change belongs partly
 * to each version. Midday decides it: a version that took over in the morning
 * owns that day, one that took over at night does not. That misplaces at most
 * one day's traffic per change, and `hasSplitDay` tells the reader which rows
 * carry the uncertainty instead of hiding it.
 */
function versionOnDay(ordered: FunnelPageVersion[], day: string): FunnelPageVersion | null {
  const midday = `${day}T12:00:00.000Z`;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const v = ordered[i];
    // The earliest version reaches back indefinitely (history starts with the sync).
    const from = i === 0 ? "" : v.valid_from;
    if (from <= midday && (v.valid_to === null || v.valid_to > midday)) return v;
  }
  return null;
}

/** Several ads point at one page, so their day rows are summed into one series. */
function mergeDays(rows: { date: string; spend: number; lpv: number; leads: number }[]) {
  const byDate = new Map<string, { date: string; spend: number; lpv: number; leads: number }>();
  for (const r of rows) {
    const m = byDate.get(r.date) ?? { date: r.date, spend: 0, lpv: 0, leads: 0 };
    m.spend += r.spend;
    m.lpv += r.lpv;
    m.leads += r.leads;
    byDate.set(r.date, m);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** True when a version boundary falls inside this calendar day. */
const isSplitDay = (ordered: FunnelPageVersion[], day: string) =>
  ordered.some((v, i) => i > 0 && v.valid_from >= `${day}T00:00:00.000Z` && v.valid_from <= `${day}T23:59:59.999Z`);

/**
 * Split one page's figures across the versions that earned them, using day-level
 * rows. Returns [] when there are no daily rows or no history: a split we can't
 * measure is not one we invent.
 */
export function splitPageVersions(
  versions: FunnelPageVersion[],
  days: { date: string; spend: number; lpv: number; leads: number }[],
): PageVersionRow[] {
  if (versions.length === 0 || days.length === 0) return [];

  const ordered = [...versions].sort((a, b) => a.valid_from.localeCompare(b.valid_from));
  const buckets = new Map<number, { spend: number; lpv: number; leads: number; days: number; split: boolean }>();

  for (const d of days) {
    const v = versionOnDay(ordered, d.date);
    if (!v) continue;
    const b = buckets.get(v.version) ?? { spend: 0, lpv: 0, leads: 0, days: 0, split: false };
    b.spend += d.spend;
    b.lpv += d.lpv;
    b.leads += d.leads;
    b.days += 1;
    b.split ||= isSplitDay(ordered, d.date);
    buckets.set(v.version, b);
  }

  return ordered
    .filter((v) => buckets.has(v.version))
    .map((v): PageVersionRow => {
      const b = buckets.get(v.version)!;
      return {
        version: v.version,
        headline: v.page_headline,
        status: v.valid_to === null ? "live" : "off",
        days: b.days,
        spend: b.spend,
        lpv: b.lpv,
        leads: b.leads,
        costPerLead: b.leads > 0 ? b.spend / b.leads : null,
        hasSplitDay: b.split,
        ...rate(b.leads, b.lpv),
      };
    })
    .sort((a, b) => b.version - a.version);
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
      mixedPages: rows.filter((r) => r.spanned > 1).length,
      pages: rows.length,
      // Sorted, not in page order: this is a tooltip list, and it shouldn't
      // reshuffle when the ranking changes.
      clients: [...new Set(rows.map((r) => r.accountName))].sort(),
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
 * Best to worst, in three tiers, so a page is never ranked against a number that
 * doesn't apply to it:
 *
 *   0. Priced pages — ordered by cost per lead against their own client's
 *      benchmark, cheapest first.
 *   1. Pages that spent and produced no lead at all — worse than any priced
 *      page, and the more they spent the worse.
 *   2. Pages that can't be ranked — a tracking gap, or a client with no
 *      benchmark to measure against. Last, because unknown is not bad.
 */
function rankTier(p: { verdict: Verdict; benchmarkIndex: number | null; benchmark: Benchmark | null; spend: number }): number {
  if (p.verdict === "unscored") return 2;
  if (p.benchmarkIndex !== null) return 0;
  return p.benchmark && p.spend > 0 ? 1 : 2;
}

function compareRank(
  a: { verdict: Verdict; benchmarkIndex: number | null; benchmark: Benchmark | null; spend: number },
  b: { verdict: Verdict; benchmarkIndex: number | null; benchmark: Benchmark | null; spend: number },
): number {
  const tier = rankTier(a) - rankTier(b);
  if (tier !== 0) return tier;
  if (rankTier(a) === 0) return a.benchmarkIndex! - b.benchmarkIndex!;
  return b.spend - a.spend;
}

/**
 * One line in the ranked list. A page that ran a single copy version in the
 * period is one row; a page that was rewritten mid-period becomes one row per
 * version, each judged only on what it earned while it was live.
 *
 * Splitting them is the point: a version that launched today, put next to a
 * month of its predecessor's spend, reads as that predecessor's verdict under
 * the new headline — which is precisely backwards.
 */
export interface RankedEntry extends Judgement {
  /** Unique per rendered row: the page key, plus the version when split. */
  key: string;
  page: PortfolioPage;
  /** Null when this row is the page as a whole (only one version ran). */
  version: number | null;
  variant: string | null;
  /** "live" = serving now, "off" = replaced. Null on a whole-page row. */
  versionStatus: "live" | "off" | null;
  headline: string | null;
  /** Days this version was live inside the period. Null on a whole-page row. */
  days: number | null;
  spend: number;
  lpv: number;
  leads: number;
  cvr: number | null;
  interval: { low: number; high: number } | null;
  benchmark: Benchmark | null;
  benchmarkIndex: number | null;
  /** This version owns the changeover day, so its totals are ±1 day of exact. */
  hasSplitDay: boolean;
}

/**
 * Expand pages into the rows the ranked list shows, then order them together.
 * Versions of one page compete in the same ranking as every other page, which
 * is the only way "best to worst" stays a single honest ordering.
 */
export function rankEntries(pages: PortfolioPage[]): RankedEntry[] {
  const entries: RankedEntry[] = [];

  for (const page of pages) {
    if (page.versionRows.length < 2) {
      entries.push({
        key: page.key,
        page,
        version: page.version,
        variant: null,
        versionStatus: null,
        headline: page.headline,
        days: null,
        spend: page.spend,
        lpv: page.lpv,
        leads: page.leads,
        cvr: page.cvr,
        interval: page.interval,
        benchmark: page.benchmark,
        benchmarkIndex: page.benchmarkIndex,
        hasSplitDay: false,
        verdict: page.verdict,
        costPer: page.costPer,
        expected: page.expected,
        excessSpend: page.excessSpend,
        savings: page.savings,
        reason: page.reason,
      });
      continue;
    }

    for (const v of page.versionRows) {
      // Judged against the same client benchmark the page uses, on this
      // version's own spend and leads — never the page's blended totals.
      const verdict = judge({ spend: v.spend, results: v.leads }, page.benchmark, "leads", {
        trackingGap: page.verdict === "unscored",
      });
      entries.push({
        key: `${page.key}#v${v.version}`,
        page,
        version: v.version,
        variant: null,
        versionStatus: v.status,
        headline: v.headline,
        days: v.days,
        spend: v.spend,
        lpv: v.lpv,
        leads: v.leads,
        cvr: v.cvr,
        interval: v.interval,
        benchmark: page.benchmark,
        benchmarkIndex:
          page.benchmark && verdict.costPer !== null && verdict.verdict !== "unscored"
            ? verdict.costPer / page.benchmark.costPer
            : null,
        hasSplitDay: v.hasSplitDay,
        ...verdict,
      });
    }
  }

  return entries.sort(compareRank);
}

/** The CRM's own leads for the period, per account id. */
export interface PortfolioGhl {
  byAccount: Map<string, GhlConversionLite[]>;
  since?: string;
  until?: string;
}

const isLead = (t: string | null | undefined) => {
  const v = t?.toLowerCase() ?? "";
  return v === "lead" || v === "water test";
};

/**
 * Put the CRM's leads on the page that earned them, in two steps:
 *
 *   1. A lead carrying an ad name belongs to whichever page that ad points at.
 *      This is a measurement — the funnel passed utm_content through.
 *   2. A lead with no ad name can still be placed when the client runs exactly
 *      one page with ad traffic, because there is nowhere else it could have
 *      come from. That is an inference, so the page is flagged `crmInferred`
 *      and the UI labels it rather than passing it off as tracked.
 *
 * Anything left — no ad name, several pages — is returned as unallocated and
 * shown as such. It is never spread across pages: a made-up split would read
 * exactly like a measured one.
 */
function allocateCrmLeads(pages: PortfolioPage[], ghl: PortfolioGhl): number {
  const byAccount = new Map<string, PortfolioPage[]>();
  for (const p of pages) byAccount.set(p.accountId, [...(byAccount.get(p.accountId) ?? []), p]);

  let unallocated = 0;
  for (const [accountId, accountPages] of byAccount) {
    const rows = ghl.byAccount.get(accountId) ?? [];
    // An ad name maps to a page through the ads that page collected.
    const pageOfAd = new Map<string, PortfolioPage>();
    for (const p of accountPages) for (const n of p.adNames) pageOfAd.set(n, p);

    let loose = 0;
    for (const r of rows) {
      if (ghl.since && r.created_on < ghl.since) continue;
      if (ghl.until && r.created_on > ghl.until) continue;
      if (!isLead(r.type)) continue;
      const name = r["Ad Name"]?.trim();
      const hit = name ? pageOfAd.get(adNameKey(name)) : undefined;
      if (hit) hit.crmLeads += 1;
      else loose += 1;
    }

    if (loose === 0) continue;
    const entry = accountPages.filter((p) => p.lpv > 0 || p.spend > 0);
    if (entry.length === 1) {
      entry[0].crmLeads += loose;
      entry[0].crmInferred = true;
    } else {
      unallocated += loose;
    }
  }
  return unallocated;
}

/**
 * Every client's landing pages for one period. `accounts` carries the CPL
 * targets, `links` the synced page copy, `ghl` the CRM's own leads, `hidden`
 * the clients kept off the dashboard.
 */
export function analyzePortfolioFunnel(
  portfolio: PortfolioAccount[],
  accounts: FunnelAccountInfo[],
  links: FunnelPageCopy[],
  hidden: string[],
  ghl: PortfolioGhl = { byAccount: new Map(), since: undefined, until: undefined },
  versions: FunnelPageVersion[] = [],
): PortfolioFunnel {
  const copyByAccount = new Map<string, Map<string, FunnelPageCopy>>();
  for (const l of links) {
    const forAccount = copyByAccount.get(l.account_name) ?? new Map<string, FunnelPageCopy>();
    forAccount.set(normalizePageUrl(l.url), l);
    copyByAccount.set(l.account_name, forAccount);
  }

  // Only arm "a" forms the sequential timeline this file reasons about.
  //
  // A split test puts two versions live at once, and the day-splitting below
  // assumes versions follow one another: given two open versions it would hand
  // every day to whichever sorts last, crediting all of a page's Meta traffic
  // to one arm. Meta cannot tell the arms apart in any case — it attributes to
  // the ad, and both arms share one ad — so arms are measured by the page's own
  // view and lead events instead, and are reported by the split-test panels.
  const versionsByPage = new Map<string, FunnelPageVersion[]>();
  for (const v of versions) {
    if ((v.variant ?? "a") !== "a") continue;
    const key = normalizePageUrl(v.url);
    versionsByPage.set(key, [...(versionsByPage.get(key) ?? []), v]);
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

    // Day-level rows, indexed by ad, so each page's figures can be cut at a copy change.
    const dailyByAd = new Map<string, { date: string; spend: number; lpv: number; leads: number }[]>();
    for (const d of acct.daily ?? []) {
      dailyByAd.set(d.adId, [
        ...(dailyByAd.get(d.adId) ?? []),
        { date: d.date, spend: d.spend, lpv: d.landingPageViews, leads: d.webLeads },
      ]);
    }
    if (byPage.size > 0) clients.add(acct.accountName);

    for (const [key, ads] of byPage) {
      const synced = copyByAccount.get(acct.accountName)?.get(key);
      const pageVersions = versionsByPage.get(key) ?? [];
      let copy = detectPageCopy(synced);
      // A page that splits its traffic to sub-paths holds no copy of its own —
      // it is a signpost, not a page. Its recorded arm-A copy is what a visitor
      // sent here actually reads, so the row shows that rather than claiming
      // the page was never synced.
      if (!copy.copy && pageVersions.length > 0) {
        const live = pageVersions.filter((v) => v.valid_to === null).sort((a, b) => b.version - a.version)[0];
        if (live?.page_headline) {
          copy = detectPageCopy({ ...synced, url: synced?.url ?? "", label: synced?.label ?? "", page_title: null, page_headline: live.page_headline });
        }
      }
      if (!copy.copy) unsynced += 1;
      const spend = sum(ads, (a) => a.spend);
      const leads = sum(ads, (a) => a.webLeads);
      const lpv = sum(ads, (a) => a.landingPageViews);
      const verdict = judge({ spend, results: leads }, benchmark, "leads", { trackingGap });
      pages.push({
        key,
        accountId: acct.accountId,
        accountName: acct.accountName,
        url: synced?.url ?? ads[0].copy.destinationUrls[0],
        label: synced?.label ?? pagePath(key),
        ...copy,
        adCount: ads.length,
        adsets: [...new Set(ads.map((a) => a.adset).filter((s): s is string => !!s))],
        adNames: [...new Set(ads.map((a) => adNameKey(a.name)))],
        spend,
        linkClicks: sum(ads, (a) => a.linkClicks),
        lpv,
        leads,
        benchmark,
        benchmarkIndex:
          benchmark && verdict.costPer !== null && verdict.verdict !== "unscored"
            ? verdict.costPer / benchmark.costPer
            : null,
        crmLeads: 0,
        crmInferred: false,
        versionRows: splitPageVersions(
          versionsByPage.get(key) ?? [],
          mergeDays(ads.flatMap((a) => dailyByAd.get(a.id) ?? [])),
        ),
        ...resolveCopyVersion(versionsByPage.get(key) ?? [], ghl.since, ghl.until),
        ...rate(leads, lpv),
        ...verdict,
      });
    }
  }

  const crmUnallocated = allocateCrmLeads(pages, ghl);

  const winners = pages.filter((p) => p.verdict === "winner").sort((a, b) => b.savings - a.savings);
  const wasters = pages.filter((p) => p.verdict === "waster").sort((a, b) => b.excessSpend - a.excessSpend);
  pages.sort(compareRank);

  // Only pages with synced copy can be grouped by what they say.
  const withCopy = pages.filter((p) => p.copy !== null);
  const lpv = sum(pages, (p) => p.lpv);
  const leads = sum(pages, (p) => p.leads);

  return {
    pages,
    ranked: rankEntries(pages),
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
    mixedCopyPages: pages.filter((p) => p.spanned > 1).length,
    crmUnallocated,
    clients: clients.size,
    spend: sum(pages, (p) => p.spend),
    lpv,
    leads,
    excess: sum(wasters, (p) => p.excessSpend),
    savings: sum(winners, (p) => p.savings),
    portfolioCvr: rate(leads, lpv).cvr,
  };
}
