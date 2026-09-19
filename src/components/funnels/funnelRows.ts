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
  /**
   * Form submits the page itself recorded. Not the same thing as a lead in the
   * CRM, and deliberately not called one: the page sees every opt-in, while the
   * CRM only holds the ones that reached GoHighLevel carrying both lp_page and
   * lp_variant. This is the count the arm's rate is built on, because it and
   * `views` are measured by the same beacon on the same page.
   */
  optIns: number;
  /**
   * Leads the CRM holds for this arm — the same measure the page card's Leads
   * figure uses, so the two reconcile. Null when this arm has no attribution.
   * Fewer than `optIns` means opt-ins reached GoHighLevel without their page
   * and variant, usually an unmapped `lp_page` custom field on that account.
   */
  crmLeads: number | null;
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
   * Leads this page produced, counted only where the lead carries both an
   * `lp_page` and an `lp_variant` from the funnel's UTM parameters. Nothing
   * else counts here: a lead the page cannot be proved to have produced tells
   * you nothing about the page, and Meta's pixel lead counts one opt-in
   * several times.
   *
   * Null means the measurement does not exist yet for this page's client —
   * either the page had no ad traffic, or that sub-account has never sent an
   * attributed lead, so its custom fields are not mapped. Null is never zero:
   * a client with no attribution has an unknown lead count, not none.
   */
  verifiedLeads: number | null;
  /**
   * Attributed leads ÷ page views, with its Wilson interval. Computed here
   * rather than read off `perf.cvr`, which is Meta's lead count over the same
   * views and so runs high. Null whenever `verifiedLeads` is.
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
  /** Attributed leads across every page: carrying lp_page and lp_variant only. */
  leads: number;
  /**
   * GHL leads in this period that carry no lp_page/lp_variant, so no page can
   * claim them. Shown, never counted — it is the size of what attribution does
   * not yet cover.
   */
  unattributedLeads: number;
  /** Views belonging to pages whose leads are measured; the denominator of `cvr`. */
  measuredLpv: number;
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
    a.pValue = twoProportionPValue(leader.optIns, leader.views, a.optIns, a.views);
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
  const byVariant = new Map<string, { views: number; optIns: number }>();
  for (const d of days) {
    const b = byVariant.get(d.variant) ?? { views: 0, optIns: 0 };
    b.views += d.views;
    b.optIns += d.leads;
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
    const b = byVariant.get(variant) ?? { views: 0, optIns: 0 };
    const crm = bookedBy.get(variant) ?? null;
    return {
      variant,
      headline: headlineFor(variant),
      weight: record.weights?.[variant] ?? null,
      views: b.views,
      optIns: b.optIns,
      crmLeads: crm?.leads ?? null,
      status: "needs_traffic",
      pValue: null,
      booked: crm?.booked ?? null,
      bookedRate: crm && crm.leads > 0 ? crm.booked / crm.leads : null,
      ...rate(b.optIns, b.views),
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
  unattributedLeads = 0,
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
  /** GHL leads in the period carrying no lp_page/lp_variant. */
  unattributedLeads?: number;
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
    const attributed = pageBookings.reduce((s, b) => s + b.leads, 0);
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
      // Filled in below, once it is known whether this client sends attribution
      // at all: a page under a client that never has cannot be read as zero.
      verifiedLeads: attributed,
      verifiedCvr: null,
      verifiedInterval: null,
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

  // A client that has never sent an attributed lead in this period has no
  // measurement, not a measurement of zero — every one of its pages reads
  // "not tracked" until its GHL custom fields are mapped. A client that does
  // send them can be read literally, so a genuine zero on one of its pages is
  // a real zero (design rule #5: unmapped and zero are different states).
  const attributedClients = new Set(rows.filter((r) => r.verifiedLeads! > 0).map((r) => r.accountName));
  for (const r of rows) {
    if (!r.perf || !attributedClients.has(r.accountName)) {
      r.verifiedLeads = null;
      continue;
    }
    const { cvr, interval } = rate(r.verifiedLeads!, r.perf.lpv);
    r.verifiedCvr = cvr;
    r.verifiedInterval = interval;
  }

  // Clients together, then biggest spender first, then idle pages by name — so
  // the page costing the most money is always the first thing read.
  rows.sort((a, b) =>
    a.accountName.localeCompare(b.accountName) ||
    (b.perf?.spend ?? -1) - (a.perf?.spend ?? -1) ||
    a.label.localeCompare(b.label));

  const withTraffic = rows.filter((r) => r.perf !== null);
  const lpv = withTraffic.reduce((s, r) => s + (r.perf?.lpv ?? 0), 0);
  // Attributed leads only. `perf.leads` is Meta's pixel count and is
  // deliberately never summed here: it counts one opt-in several times.
  //
  // The rate divides by the views of the *measured* pages alone. Dividing
  // attributed leads by every page's views would mix a numerator that excludes
  // unmapped clients with a denominator that includes them, and report a
  // conversion rate lower than any real page's.
  const measured = withTraffic.filter((r) => r.verifiedLeads !== null);
  const leads = measured.reduce((s, r) => s + (r.verifiedLeads ?? 0), 0);
  const measuredLpv = measured.reduce((s, r) => s + (r.perf?.lpv ?? 0), 0);

  return {
    rows,
    clients: new Set(rows.map((r) => r.accountName)).size,
    idle: rows.length - withTraffic.length,
    withTraffic: withTraffic.length,
    runningTests: rows.filter((r) => r.runningTest).length,
    spend: withTraffic.reduce((s, r) => s + (r.perf?.spend ?? 0), 0),
    lpv,
    leads,
    unattributedLeads,
    /** Over the views of pages whose leads are actually measured, not all views. */
    measuredLpv,
    cvr: rate(leads, measuredLpv).cvr,
  };
}
