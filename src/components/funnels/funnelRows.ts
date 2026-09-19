// The Funnels screen: one row per landing page the agency actually runs, with
// everything needed to judge and change it in one place — what it says now,
// what it said before, what it earned, which ads feed it, and any split test
// running on it.
//
// It deliberately starts from the *pages*, not from the ad data. A page with no
// traffic is a fact worth seeing (it's built and idle), and a board assembled
// from Meta alone would silently omit it. Pages are joined to performance, not
// derived from it.

import type { CreativeAd, PortfolioAccount } from "@/components/creative-performance/useCreativePerformance";
import { landingPageKey } from "@/components/creative-performance/breakdowns";
import { twoProportionPValue, wilsonInterval } from "@/lib/stats";
import { normalizePageUrl, pagePath } from "@/lib/urls";
import { detectPageCopy } from "@/components/funnel/funnelMath";
import type {
  FunnelPageCopy,
  FunnelPageVersion,
  PortfolioPage,
} from "@/components/funnel/portfolioFunnel";
import type { AngleKey, OfferKey } from "@/components/creative-performance/labels";
import type { SplitTestRecord, VariantBookingRecord, VariantDayRecord } from "./useFunnelsData";

/** Below this many views on an arm, a split test's rate is too noisy to read. */
export const MIN_ARM_VIEWS = 100;
const SIGNIFICANCE = 0.05;

/** Booking, thank-you and confirmation pages are funnel steps, not entry pages. */
export const isEntryPage = (url: string) => !/schedule|calendar|booking|thank|confirm/i.test(url);

/** One ad pointing at a page. */
export interface FunnelAd {
  id: string;
  name: string;
  adset: string | null;
  live: boolean;
  status: string;
  spend: number;
  linkClicks: number;
  lpv: number;
  adsManagerUrl: string | null;
}

/** One arm of a split test, measured from our own page events. */
export interface SplitArm {
  variant: string;
  headline: string | null;
  weight: number | null;
  views: number;
  leads: number;
  cvr: number | null;
  interval: { low: number; high: number } | null;
  /**
   * Appointments booked off this arm, from GHL. Null when the arm has no
   * attribution at all — an arm whose leads predate lp_variant, or whose client
   * hasn't mapped the field yet, has an *unknown* booked count, not zero.
   */
  booked: number | null;
  /** Booked per lead, both counted by GHL so the ratio is from one source. */
  bookedRate: number | null;
  /** "leader" once an arm is ahead with enough traffic; "behind" when beaten at 95%. */
  status: "leader" | "behind" | "even" | "needs_traffic";
  pValue: number | null;
}

export interface SplitTest {
  id: string;
  name: string | null;
  running: boolean;
  startedAt: string;
  stoppedAt: string | null;
  winnerVariant: string | null;
  arms: SplitArm[];
  /** True once some arm is ahead at 95% with both arms over the view floor. */
  decided: boolean;
}

/** One recorded copy version, newest first in the row. */
export interface VersionEntry {
  version: number;
  variant: string;
  headline: string | null;
  subhead: string | null;
  live: boolean;
  from: string;
  to: string | null;
}

export interface FunnelRow {
  key: string; // normalized URL
  url: string;
  label: string;
  accountName: string;
  /** Copy currently on the page, from the funnel repo. Null when never synced. */
  headline: string | null;
  subhead: string | null;
  cta: string | null;
  offer: OfferKey | null;
  angle: AngleKey | null;
  copySyncedAt: string | null;
  /** Performance in the selected period. Null when no ad sent traffic here. */
  perf: PortfolioPage | null;
  /**
   * Leads this page produced, counted as contacts GoHighLevel actually holds.
   * This is the only lead number the board shows: Meta's pixel lead is not
   * reported here, because GHL's CAPI re-fires on contact updates and inflated
   * every account roughly twofold. Null when no ad sent traffic to the page.
   */
  verifiedLeads: number | null;
  /**
   * True when this client has CRM leads that carry no ad name and could not be
   * placed on any one page, so `verifiedLeads` is a floor rather than a total.
   */
  verifiedPartial: boolean;
  /**
   * Verified leads ÷ page views, with its Wilson interval. Computed here rather
   * than read off `perf.cvr`, which is Meta's lead count over the same views and
   * so runs high. Null when the page had no ad traffic.
   */
  verifiedCvr: number | null;
  verifiedInterval: { low: number; high: number } | null;
  ads: FunnelAd[];
  versions: VersionEntry[];
  liveVersion: number | null;
  runningTest: SplitTest | null;
  pastTests: SplitTest[];
}

export interface FunnelsBoard {
  rows: FunnelRow[];
  clients: number;
  /** Entry pages that have never been sent ad traffic in this period. */
  idle: number;
  withTraffic: number;
  runningTests: number;
  spend: number;
  lpv: number;
  /** Verified leads across every page with traffic: GHL contacts, never Meta's pixel. */
  leads: number;
  /** Verified leads that belong to no single page, so `leads` is a floor. */
  unallocatedLeads: number;
  cvr: number | null;
}

function rate(leads: number, views: number) {
  if (views <= 0 || leads > views) return { cvr: null, interval: null };
  return { cvr: leads / views, interval: wilsonInterval(leads, views) };
}

/**
 * Score a test's arms against each other. The leader is only called once both
 * it and the arm it beat clear the view floor — an arm that is "ahead" on 30
 * views is ahead of nothing.
 */
export function scoreArms(arms: SplitArm[]): { arms: SplitArm[]; decided: boolean } {
  const eligible = arms.filter((a) => a.views >= MIN_ARM_VIEWS && a.cvr !== null);
  for (const a of arms) a.status = a.views >= MIN_ARM_VIEWS && a.cvr !== null ? "even" : "needs_traffic";
  if (eligible.length < 2) return { arms, decided: false };

  const leader = eligible.reduce((a, b) => (b.cvr! > a.cvr! ? b : a));
  leader.status = "leader";
  let decided = false;
  for (const a of eligible) {
    if (a === leader) continue;
    a.pValue = twoProportionPValue(leader.leads, leader.views, a.leads, a.views);
    if (a.pValue !== null && a.pValue < SIGNIFICANCE) {
      a.status = "behind";
      decided = true;
    }
  }
  return { arms, decided };
}

function buildTest(
  record: SplitTestRecord,
  versions: FunnelPageVersion[],
  days: VariantDayRecord[],
  bookings: VariantBookingRecord[],
): SplitTest {
  const byVariant = new Map<string, { views: number; leads: number }>();
  for (const d of days) {
    const b = byVariant.get(d.variant) ?? { views: 0, leads: 0 };
    b.views += d.views;
    b.leads += d.leads;
    byVariant.set(d.variant, b);
  }

  // Booked is kept in its own map, on purpose. An arm missing from it has no
  // GHL attribution and must read as unknown; an arm present with 0 booked is
  // a real zero. Defaulting to 0 would erase that difference.
  const bookedBy = new Map<string, { leads: number; booked: number }>();
  for (const b of bookings) {
    const e = bookedBy.get(b.variant) ?? { leads: 0, booked: 0 };
    e.leads += b.leads;
    e.booked += b.booked;
    bookedBy.set(b.variant, e);
  }
  // Every arm the test declares weights for, plus any that reported events.
  const keys = [...new Set([...Object.keys(record.weights ?? {}), ...byVariant.keys()])].sort();
  const headlineFor = (variant: string) =>
    versions.filter((v) => v.variant === variant).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]
      ?.page_headline ?? null;

  const arms = keys.map((variant): SplitArm => {
    const b = byVariant.get(variant) ?? { views: 0, leads: 0 };
    const crm = bookedBy.get(variant) ?? null;
    return {
      variant,
      headline: headlineFor(variant),
      weight: record.weights?.[variant] ?? null,
      views: b.views,
      leads: b.leads,
      status: "needs_traffic",
      pValue: null,
      booked: crm?.booked ?? null,
      bookedRate: crm && crm.leads > 0 ? crm.booked / crm.leads : null,
      ...rate(b.leads, b.views),
    };
  });

  const scored = scoreArms(arms);
  return {
    id: record.id,
    name: record.name,
    running: record.status === "running",
    startedAt: record.started_at,
    stoppedAt: record.stopped_at,
    winnerVariant: record.winner_variant,
    arms: scored.arms,
    decided: scored.decided,
  };
}

/**
 * Join every synced landing page to its performance, ads, versions and tests.
 * `pages` are the judged rows the funnel scorecard already computed, so the two
 * screens can never disagree about what a page earned.
 */
export function buildFunnelsBoard({
  links,
  pages,
  portfolio,
  versions,
  tests,
  variantDays,
  variantBookings = [],
  crmUnallocatedByAccount = new Map(),
  hidden = [],
  entryOnly = true,
}: {
  links: FunnelPageCopy[];
  pages: PortfolioPage[];
  portfolio: PortfolioAccount[];
  versions: FunnelPageVersion[];
  tests: SplitTestRecord[];
  variantDays: VariantDayRecord[];
  variantBookings?: VariantBookingRecord[];
  /** Per account id, CRM leads that could not be placed on one page. */
  crmUnallocatedByAccount?: Map<string, number>;
  hidden?: string[];
  entryOnly?: boolean;
}): FunnelsBoard {
  const perfByKey = new Map(pages.map((p) => [p.key, p]));

  const adsByKey = new Map<string, FunnelAd[]>();
  for (const acct of portfolio) {
    if (hidden.includes(acct.accountName) || acct.error) continue;
    for (const ad of (acct.ads ?? []) as CreativeAd[]) {
      if (ad.leadChannel !== "website") continue;
      const key = landingPageKey(ad);
      if (key.startsWith("__")) continue;
      adsByKey.set(key, [
        ...(adsByKey.get(key) ?? []),
        {
          id: ad.id,
          name: ad.name,
          adset: ad.adset,
          live: ad.live,
          status: ad.status,
          spend: ad.spend,
          linkClicks: ad.linkClicks,
          lpv: ad.landingPageViews,
          adsManagerUrl: ad.adsManagerUrl ?? null,
        },
      ]);
    }
  }

  const versionsByKey = new Map<string, FunnelPageVersion[]>();
  for (const v of versions) {
    const key = normalizePageUrl(v.url);
    versionsByKey.set(key, [...(versionsByKey.get(key) ?? []), v]);
  }

  const testsByKey = new Map<string, SplitTestRecord[]>();
  for (const t of tests) {
    const key = normalizePageUrl(t.url);
    testsByKey.set(key, [...(testsByKey.get(key) ?? []), t]);
  }

  const daysByKey = new Map<string, VariantDayRecord[]>();
  for (const d of variantDays) {
    const key = normalizePageUrl(d.url);
    daysByKey.set(key, [...(daysByKey.get(key) ?? []), d]);
  }

  const bookingsByKey = new Map<string, VariantBookingRecord[]>();
  for (const b of variantBookings) {
    const key = normalizePageUrl(b.url);
    bookingsByKey.set(key, [...(bookingsByKey.get(key) ?? []), b]);
  }

  const rows: FunnelRow[] = [];
  for (const link of links) {
    if (hidden.includes(link.account_name)) continue;
    if (entryOnly && !isEntryPage(link.url)) continue;

    const key = normalizePageUrl(link.url);
    const copy = detectPageCopy(link);
    const pageVersions = versionsByKey.get(key) ?? [];
    const pageDays = daysByKey.get(key) ?? [];
    const pageBookings = bookingsByKey.get(key) ?? [];
    const within = (t: SplitTestRecord) => (day: string) =>
      day >= t.started_at.slice(0, 10) && (t.stopped_at === null || day <= t.stopped_at.slice(0, 10));
    const allTests = (testsByKey.get(key) ?? []).map((t) =>
      buildTest(
        t,
        pageVersions,
        pageDays.filter((d) => within(t)(d.day)),
        pageBookings.filter((b) => within(t)(b.day)),
      ));

    const perf = perfByKey.get(key) ?? null;
    // A page with no ad traffic has no lead count to report — that is unknown,
    // not zero, so every verified figure below stays null for it.
    const verified = perf ? rate(perf.crmLeads, perf.lpv) : { cvr: null, interval: null };
    rows.push({
      key,
      url: link.url,
      label: link.label || pagePath(key),
      accountName: link.account_name,
      headline: copy.headline,
      subhead: link.page_subhead,
      cta: link.page_cta,
      offer: copy.offer,
      angle: copy.angle,
      copySyncedAt: link.copy_synced_at,
      perf,
      verifiedLeads: perf ? perf.crmLeads : null,
      verifiedPartial: !!perf && (crmUnallocatedByAccount.get(perf.accountId) ?? 0) > 0,
      verifiedCvr: verified.cvr,
      verifiedInterval: verified.interval,
      ads: (adsByKey.get(key) ?? []).sort((a, b) => b.spend - a.spend),
      versions: [...pageVersions]
        .sort((a, b) => b.valid_from.localeCompare(a.valid_from))
        .map((v) => ({
          version: v.version,
          variant: v.variant ?? "a",
          headline: v.page_headline,
          subhead: null,
          live: v.valid_to === null,
          from: v.valid_from,
          to: v.valid_to,
        })),
      liveVersion: pageVersions.filter((v) => v.valid_to === null).map((v) => v.version).sort((a, b) => b - a)[0] ?? null,
      runningTest: allTests.find((t) => t.running) ?? null,
      pastTests: allTests.filter((t) => !t.running),
    });
  }

  // Clients together, then biggest spender first, then idle pages by name — so
  // the page costing the most money is always the first thing read.
  rows.sort((a, b) =>
    a.accountName.localeCompare(b.accountName) ||
    (b.perf?.spend ?? -1) - (a.perf?.spend ?? -1) ||
    a.label.localeCompare(b.label));

  const withTraffic = rows.filter((r) => r.perf !== null);
  const lpv = withTraffic.reduce((s, r) => s + (r.perf?.lpv ?? 0), 0);
  // Verified leads, not Meta's. `perf.leads` is Meta's pixel count and is
  // deliberately not summed here: it counts one opt-in several times.
  const leads = withTraffic.reduce((s, r) => s + (r.verifiedLeads ?? 0), 0);
  const shownAccounts = new Set(rows.map((r) => r.perf?.accountId).filter((id): id is string => !!id));
  const unallocatedLeads = [...crmUnallocatedByAccount]
    .filter(([id]) => shownAccounts.has(id))
    .reduce((s, [, n]) => s + n, 0);

  return {
    rows,
    clients: new Set(rows.map((r) => r.accountName)).size,
    idle: rows.length - withTraffic.length,
    withTraffic: withTraffic.length,
    runningTests: rows.filter((r) => r.runningTest).length,
    spend: withTraffic.reduce((s, r) => s + (r.perf?.spend ?? 0), 0),
    lpv,
    leads,
    unallocatedLeads,
    cvr: rate(leads, lpv).cvr,
  };
}
