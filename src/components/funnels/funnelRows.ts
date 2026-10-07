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
import { chanceToBeBest, viewsToCall, wilsonInterval } from "@/lib/stats";
import { normalizePageUrl, pagePath } from "@/lib/urls";
import { detectPageCopy } from "@/components/funnel/funnelMath";
import { judge } from "@/components/creative-performance/verdicts";
import type {
  FunnelPageCopy,
  FunnelPageVersion,
  PortfolioPage,
} from "@/components/funnel/portfolioFunnel";
import type { AngleKey, OfferKey } from "@/components/creative-performance/labels";
import type { SplitTestRecord, VariantBookingRecord, VariantDayRecord } from "./useFunnelsData";

/** Below this many views on an arm, a split test can't be called, however lopsided. */
export const MIN_ARM_VIEWS = 100;
/** Chance-to-be-best that calls a winner (with every arm over the view floor). */
export const CALL_AT = 0.95;
/** Chance-to-be-best that earns "Leading": a lean worth watching, never a call. */
export const LEAN_AT = 0.75;
/** A winner needs at least this many leads: two leads is an anecdote. */
const MIN_WINNER_LEADS = 3;
/** Past this many more views per arm, the gap is too small to be worth waiting for. */
export const NOT_WORTH_WAITING = 2000;

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
   * Leads on this arm: GoHighLevel contacts carrying both lp_page and
   * lp_variant, exactly as the page card above counts them. One definition of
   * a lead on this whole screen. Null when this arm has no attributed lead at
   * all, which is unknown rather than zero.
   */
  leads: number | null;
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
  /**
   * Chance this arm has the best true lead rate (views → attributed lead),
   * from Beta posteriors over every measured arm. Null when the arm isn't
   * measured. The arms' chances sum to 1.
   */
  chanceBest: number | null;
  /** Same, on views → booked appointment. Null unless 2+ arms have booking data. */
  apptChanceBest: number | null;
  /** Lead rate relative to the control arm (first letter): 0.25 = 25% better. */
  lift: number | null;
  /**
   * winner: ≥95% chance to be best, every arm over the view floor, 3+ leads.
   * leading: ≥75% chance, not callable yet. trailing: the other arms while one leads.
   * losing: ≤5% chance once a winner is called. even: measured, nothing separates.
   * needs_traffic: under the view floor with no lean. not_tracked: no attribution.
   */
  status: "winner" | "leading" | "trailing" | "losing" | "even" | "needs_traffic" | "not_tracked";
}

/** How far a running test is from a call, at the traffic it is getting now. */
export interface CallEstimate {
  /** More views each arm needs before the current gap would read at 95%. */
  viewsPerArm: number;
  /** At the last 7 days' pace. Null when the test had no views in that window. */
  days: number | null;
  /** The gap is so small that waiting isn't worth it: call it even, test something bolder. */
  notWorthWaiting: boolean;
}

export interface SplitTest {
  id: string;
  name: string | null;
  running: boolean;
  startedAt: string;
  stoppedAt: string | null;
  winnerVariant: string | null;
  arms: SplitArm[];
  /** True once an arm is a winner. */
  decided: boolean;
  /** The arm most likely to be best, and how likely. Null with fewer than two measured arms. */
  leader: string | null;
  leaderChance: number | null;
  /** The arm lift is measured against: the first letter (a, or c in a second era). */
  control: string | null;
  callIn: CallEstimate | null;
  daysRunning: number;
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
  /**
   * Water tests booked by this page's attributed leads, from GHL (a contact
   * whose type flipped to "water test"). Same contacts as `verifiedLeads`, so
   * the two divide cleanly. Null whenever `verifiedLeads` is: an unmeasured
   * page has an unknown booked count, not zero.
   */
  verifiedBooked: number | null;
  /** Booked ÷ attributed leads. Null with no leads to divide by. */
  bookedRate: number | null;
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
  /** Water tests booked by attributed leads on measured pages. */
  booked: number;
  /** Booked ÷ attributed leads, over the same measured pages. */
  bookedRate: number | null;
}

function rate(leads: number, views: number) {
  if (views <= 0 || leads > views) return { cvr: null, interval: null };
  return { cvr: leads / views, interval: wilsonInterval(leads, views) };
}

/**
 * Score a test's arms on chance to be best. A winner needs a 95% chance with
 * every arm over the view floor and 3+ leads: 2 leads to 4 on 80 views is a
 * lean ("Leading"), not a result, however good it looks.
 */
export function scoreArms(arms: SplitArm[]): { arms: SplitArm[]; decided: boolean; leader: SplitArm | null } {
  for (const a of arms) {
    a.chanceBest = null;
    a.apptChanceBest = null;
    a.lift = null;
    a.status = a.leads === null ? "not_tracked" : "needs_traffic";
  }
  const measured = arms.filter((a) => a.leads !== null && a.views > 0);
  if (measured.length < 2) return { arms, decided: false, leader: null };

  const chances = chanceToBeBest(measured.map((a) => ({ successes: Math.min(a.leads!, a.views), trials: a.views })));
  measured.forEach((a, i) => (a.chanceBest = chances[i]));

  const booking = measured.filter((a) => a.booked !== null);
  if (booking.length >= 2) {
    const appt = chanceToBeBest(booking.map((a) => ({ successes: Math.min(a.booked!, a.views), trials: a.views })));
    booking.forEach((a, i) => (a.apptChanceBest = appt[i]));
  }

  const control = arms[0];
  for (const a of measured) {
    if (a !== control && control.cvr !== null && control.cvr > 0 && a.cvr !== null) a.lift = a.cvr / control.cvr - 1;
  }

  const overFloor = measured.every((a) => a.views >= MIN_ARM_VIEWS);
  const leader = measured.reduce((x, y) => (y.chanceBest! > x.chanceBest! ? y : x));
  const won = overFloor && leader.chanceBest! >= CALL_AT && leader.leads! >= MIN_WINNER_LEADS;
  const leaning = !won && leader.chanceBest! >= LEAN_AT;

  for (const a of measured) {
    if (a === leader) a.status = won ? "winner" : leaning ? "leading" : overFloor ? "even" : "needs_traffic";
    else if (won) a.status = a.chanceBest! <= 1 - CALL_AT ? "losing" : "trailing";
    else if (leaning) a.status = "trailing";
    else a.status = overFloor ? "even" : "needs_traffic";
  }
  return { arms, decided: won, leader };
}

/**
 * Views each arm still needs for the leader's gap over the runner-up to read
 * at 95%, and how many days that is at the last week's pace. Rates are
 * smoothed (+1/+2) so a 0-lead arm still yields an estimate.
 */
function estimateCall(arms: SplitArm[], leader: SplitArm, days: VariantDayRecord[]): CallEstimate | null {
  const rival = arms
    .filter((a) => a !== leader && a.chanceBest !== null)
    .reduce<SplitArm | null>((x, y) => (!x || y.chanceBest! > x.chanceBest! ? y : x), null);
  if (!rival) return null;
  const p = (a: SplitArm) => (a.leads! + 1) / (a.views + 2);
  const need = viewsToCall(p(leader), p(rival));
  const have = Math.min(leader.views, rival.views);
  const viewsPerArm = need === null ? Infinity : Math.max(need - have, MIN_ARM_VIEWS - have, 0);

  const latest = days.reduce((m, d) => (d.day > m ? d.day : m), "");
  let days7: number | null = null;
  if (latest) {
    const from = new Date(new Date(latest).getTime() - 6 * 864e5).toISOString().slice(0, 10);
    const views = days
      .filter((d) => d.day >= from && (d.variant === leader.variant || d.variant === rival.variant))
      .reduce((s, d) => s + d.views, 0);
    const perArmPerDay = views / 7 / 2;
    days7 = perArmPerDay > 0 && Number.isFinite(viewsPerArm) ? Math.ceil(viewsPerArm / perArmPerDay) : null;
  }
  const notWorthWaiting = !Number.isFinite(viewsPerArm) || viewsPerArm > NOT_WORTH_WAITING;
  return { viewsPerArm: Number.isFinite(viewsPerArm) ? viewsPerArm : NOT_WORTH_WAITING + 1, days: notWorthWaiting ? null : days7, notWorthWaiting };
}

function buildTest(
  record: SplitTestRecord,
  versions: FunnelPageVersion[],
  days: VariantDayRecord[],
  bookings: VariantBookingRecord[],
): SplitTest {
  // Views are the page's own — only the page knows which arm a visitor saw.
  // Leads are not: they are the attributed GoHighLevel contacts, same as the
  // card above, so this screen has one definition of a lead.
  const viewsBy = new Map<string, number>();
  for (const d of days) viewsBy.set(d.variant, (viewsBy.get(d.variant) ?? 0) + d.views);

  // An arm missing from this map has no GHL attribution and must read as
  // unknown; an arm present with 0 is a real zero. Defaulting to 0 erases that.
  const bookedBy = new Map<string, { leads: number; booked: number }>();
  for (const b of bookings) {
    const e = bookedBy.get(b.variant) ?? { leads: 0, booked: 0 };
    e.leads += b.leads;
    e.booked += b.booked;
    bookedBy.set(b.variant, e);
  }
  // The arms the test declares. Views on other letters in the window are old
  // arm URLs still being visited (bookmarks, returning visitors) — not part of
  // this test, and counting them would hand "control" to a retired arm. Only a
  // test with no weights recorded falls back to whatever reported events.
  const declared = Object.keys(record.weights ?? {});
  const keys = (declared.length > 0 ? declared : [...viewsBy.keys()]).sort();
  const headlineFor = (variant: string) =>
    versions.filter((v) => v.variant === variant).sort((a, b) => b.valid_from.localeCompare(a.valid_from))[0]
      ?.page_headline ?? null;

  const arms = keys.map((variant): SplitArm => {
    const views = viewsBy.get(variant) ?? 0;
    const crm = bookedBy.get(variant) ?? null;
    return {
      variant,
      headline: headlineFor(variant),
      weight: record.weights?.[variant] ?? null,
      views,
      leads: crm?.leads ?? null,
      status: "needs_traffic",
      chanceBest: null,
      apptChanceBest: null,
      lift: null,
      booked: crm?.booked ?? null,
      bookedRate: crm && crm.leads > 0 ? crm.booked / crm.leads : null,
      ...(crm ? rate(crm.leads, views) : { cvr: null, interval: null }),
    };
  });

  const scored = scoreArms(arms);
  const running = record.status === "running";
  const end = record.stopped_at ? new Date(record.stopped_at).getTime() : Date.now();
  return {
    id: record.id,
    name: record.name,
    running,
    startedAt: record.started_at,
    stoppedAt: record.stopped_at,
    winnerVariant: record.winner_variant,
    arms: scored.arms,
    decided: scored.decided,
    leader: scored.leader?.variant ?? null,
    leaderChance: scored.leader?.chanceBest ?? null,
    control: scored.arms[0]?.variant ?? null,
    callIn: running && scored.leader && !scored.decided ? estimateCall(scored.arms, scored.leader, days) : null,
    daysRunning: Math.max(0, Math.floor((end - new Date(record.started_at).getTime()) / 864e5)),
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
    const pageVersions = versionsByKey.get(key) ?? [];
    // A split-test router is a redirect with no <h1>, so the sync reads no copy
    // off it. Its copy is its arms': fall back to the live control arm (A, else
    // the lowest letter) recorded on this page, rather than "not synced".
    const control = pageVersions
      .filter((v) => v.valid_to === null && v.page_headline)
      .sort((a, b) => (a.variant ?? "a").localeCompare(b.variant ?? "a"))[0];
    const copy = detectPageCopy(
      link.page_headline || !control ? link : { ...link, page_headline: control.page_headline },
    );
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
    const booked = pageBookings.reduce((s, b) => s + b.booked, 0);
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
      verifiedBooked: booked,
      bookedRate: null,
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
      r.verifiedBooked = null;
      // The page verdict counts the same leads as the row. With none measured,
      // there is nothing to judge — Meta's pixel count is not a stand-in.
      if (r.perf) {
        r.perf = {
          ...r.perf,
          verdict: "unscored",
          reason: "Leads not tracked yet: no attributed GoHighLevel lead for this client, so cost per lead is unknown",
          costPer: null,
          benchmarkIndex: null,
        };
      }
      continue;
    }
    // Judge the page on the leads this row displays (attributed GHL contacts),
    // not Meta's pixel leads, which count one opt-in several times: a verdict
    // and the numbers beside it must come from one source.
    const j = judge({ spend: r.perf.spend, results: r.verifiedLeads! }, r.perf.benchmark, "leads");
    r.perf = {
      ...r.perf,
      verdict: j.verdict,
      reason: j.reason,
      costPer: j.costPer,
      benchmarkIndex: j.costPer !== null && r.perf.benchmark ? j.costPer / r.perf.benchmark.costPer : null,
    };
    const { cvr, interval } = rate(r.verifiedLeads!, r.perf.lpv);
    r.verifiedCvr = cvr;
    r.verifiedInterval = interval;
    r.bookedRate = r.verifiedLeads! > 0 ? r.verifiedBooked! / r.verifiedLeads! : null;
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
  const booked = measured.reduce((s, r) => s + (r.verifiedBooked ?? 0), 0);

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
    booked,
    bookedRate: leads > 0 ? booked / leads : null,
  };
}
