// Winner / money-waster verdicts for ads (and for groups of ads: an offer, a
// headline, a landing page). A verdict is a statistical claim, so it is made
// the way a media buyer should make it and never from a raw ratio:
//
//   expected = spend ÷ benchmark cost        (what the spend "should" have bought)
//   winner   = significantly MORE results than expected, and materially cheaper
//   waster   = significantly FEWER results than expected (0 counts), and materially dearer
//
// "Significantly" is a one-sided Poisson test at 90%. With zero results that
// works out to spend ≥ ~2.3× the benchmark — the classic "kill it after 2× your
// CPA with nothing to show" rule, derived rather than hard-coded. Anything short
// of that is "Too early" or "On par", so $4 of spend is never a verdict.
//
// The benchmark is the account's own target (accounts.target_cpl / target_cpa,
// design rule #6) or, when none is set, the account's average for the period —
// and the UI always says which.

import { formatCount, formatUsd } from "@/lib/format";
import { poissonCdf, poissonSf } from "@/lib/stats";
import type { CreativeAd, LeadChannel } from "./useCreativePerformance";

export type Metric = "leads" | "appointments";
export type Verdict = "winner" | "waster" | "on_par" | "learning" | "unscored" | "no_delivery";

// Statistical guardrails, the same for every client (their economics are the targets).
const ALPHA = 0.1;                 // 90% one-sided confidence before calling it
const WIN_RATIO = 0.85;            // a winner must also beat the benchmark by 15%+
const WASTE_RATIO = 1.25;          // a waster must also miss it by 25%+ (or have none)
const MIN_WIN_RESULTS = 3;         // never crown an ad on one or two results
const JUDGE_AFTER = -Math.log(ALPHA); // ≈2.3 benchmark-costs of spend with zero results
/** Frequency at which a local audience has seen the ad often enough to tire of it. */
export const FATIGUE_FREQUENCY = 3;

export const METRIC_NOUN: Record<Metric, { one: string; many: string; costLabel: string }> = {
  leads: { one: "lead", many: "leads", costLabel: "Cost / lead" },
  appointments: { one: "appt", many: "appts", costLabel: "Cost / appt" },
};

export interface Benchmark {
  costPer: number;
  source: "target" | "average";
}

export interface Judgement {
  verdict: Verdict;
  costPer: number | null;   // null with zero results, never $0
  expected: number | null;  // results the spend should have bought at the benchmark
  excessSpend: number;      // wasters: spend beyond what their results were worth
  savings: number;          // winners: value of results beyond their spend
  reason: string;
}

export const benchmarkText = (b: Benchmark, metric: Metric) =>
  `${formatUsd(b.costPer)} ${b.source === "target" ? "target" : "account avg"} per ${METRIC_NOUN[metric].one}`;

/** Results that count for this ad: its own lead source (never website + form summed), or appointments. */
export function resultsFor(ad: Pick<CreativeAd, "leadChannel" | "webLeads" | "formLeads" | "appointments">, metric: Metric): number {
  if (metric === "appointments") return ad.appointments ?? 0;
  return ad.leadChannel === "form" ? ad.formLeads : ad.webLeads;
}

export function computeBenchmark(
  ads: CreativeAd[],
  metric: Metric,
  target: number | null | undefined,
): Benchmark | null {
  if (target && target > 0) return { costPer: target, source: "target" };
  const spend = ads.reduce((s, a) => s + a.spend, 0);
  const results = ads.reduce((s, a) => s + resultsFor(a, metric), 0);
  return results > 0 ? { costPer: spend / results, source: "average" } : null;
}

/**
 * Zero results across every ad, after enough spend that the ads should have
 * produced several, is far more likely a broken event than a set of bad ads.
 * Verdicts are withheld and the UI asks for a tracking check instead.
 */
export function isTrackingGap(ads: CreativeAd[], metric: Metric, benchmark: Benchmark | null): boolean {
  if (!benchmark) return false;
  const spend = ads.reduce((s, a) => s + a.spend, 0);
  const results = ads.reduce((s, a) => s + resultsFor(a, metric), 0);
  return results === 0 && spend >= 3 * benchmark.costPer;
}

export function judge(
  { spend, results }: { spend: number; results: number },
  benchmark: Benchmark | null,
  metric: Metric,
  opts: { trackingGap?: boolean } = {},
): Judgement {
  const noun = METRIC_NOUN[metric];
  const costPer = results > 0 ? spend / results : null;
  const base = { costPer, expected: null, excessSpend: 0, savings: 0 };

  if (spend <= 0) return { ...base, verdict: "no_delivery", reason: "No spend in this period" };
  if (opts.trackingGap) {
    return { ...base, verdict: "unscored", reason: `No ${noun.many} recorded on any ad — check tracking before judging` };
  }
  if (!benchmark) {
    return { ...base, verdict: "unscored", reason: `No ${noun.many} yet and no target set` };
  }

  const b = benchmark.costPer;
  const expected = spend / b;
  const cost = costPer !== null ? `${formatUsd(costPer)} per ${noun.one}` : `0 ${noun.many}`;
  const vs = `${formatUsd(b)} ${benchmark.source === "target" ? "target" : "avg"}`;

  // A winner has also spent at least one benchmark cost: 3 leads on $24 is a
  // promising early read, not a reason to move budget.
  if (expected >= 1 && results >= MIN_WIN_RESULTS && poissonSf(results, expected) < ALPHA && costPer! <= WIN_RATIO * b) {
    return {
      verdict: "winner",
      costPer,
      expected,
      excessSpend: 0,
      savings: results * b - spend,
      reason: `${cost} vs ${vs} · ${formatCount(results)} ${results === 1 ? noun.one : noun.many}`,
    };
  }
  if (poissonCdf(results, expected) < ALPHA && (results === 0 || costPer! >= WASTE_RATIO * b)) {
    return {
      verdict: "waster",
      costPer,
      expected,
      excessSpend: spend - results * b,
      savings: 0,
      reason:
        results === 0
          ? `${formatUsd(spend)} spent, 0 ${noun.many} — ~${formatCount(Math.round(expected))} expected at ${formatUsd(b)}`
          : `${cost} vs ${vs} on ${formatUsd(spend)} spend`,
    };
  }
  if (expected < 1 || (results === 0 && expected < JUDGE_AFTER)) {
    const needed = JUDGE_AFTER * b;
    return {
      ...base,
      expected,
      verdict: "learning",
      reason: results === 0
        ? `Too early: ${formatUsd(spend)} of ~${formatUsd(needed)} needed to judge`
        : `Early read: ${cost} on ${formatUsd(spend)}`,
    };
  }
  return { ...base, expected, verdict: "on_par", reason: `${cost}, not clearly different from ${vs}` };
}

export interface ScoredAd extends Judgement {
  ad: CreativeAd;
  results: number;
  fatigued: boolean;
}

export interface Scorecard {
  benchmark: Benchmark | null;
  trackingGap: boolean;
  scored: ScoredAd[];
  winners: ScoredAd[];  // biggest savings first
  wasters: ScoredAd[];  // biggest excess spend first
  fatigued: ScoredAd[]; // highest frequency first, wasters excluded (they're already on the cut list)
  spend: number;
  wasterSpend: number;
  excessSpend: number;
}

export function scoreAds(ads: CreativeAd[], metric: Metric, target: number | null | undefined): Scorecard {
  const delivered = ads.filter((a) => a.delivered && a.spend > 0);
  const benchmark = computeBenchmark(delivered, metric, target);
  const trackingGap = isTrackingGap(delivered, metric, benchmark);

  const scored: ScoredAd[] = ads.map((ad) => {
    const results = resultsFor(ad, metric);
    return {
      ad,
      results,
      fatigued: ad.spend > 0 && (ad.frequency ?? 0) >= FATIGUE_FREQUENCY,
      ...judge({ spend: ad.spend, results }, benchmark, metric, { trackingGap }),
    };
  });

  const winners = scored.filter((s) => s.verdict === "winner").sort((a, b) => b.savings - a.savings);
  const wasters = scored.filter((s) => s.verdict === "waster").sort((a, b) => b.excessSpend - a.excessSpend);
  const fatigued = scored
    .filter((s) => s.fatigued && s.verdict !== "waster")
    .sort((a, b) => (b.ad.frequency ?? 0) - (a.ad.frequency ?? 0));

  return {
    benchmark,
    trackingGap,
    scored,
    winners,
    wasters,
    fatigued,
    spend: delivered.reduce((s, a) => s + a.spend, 0),
    wasterSpend: wasters.reduce((s, w) => s + w.ad.spend, 0),
    excessSpend: wasters.reduce((s, w) => s + w.excessSpend, 0),
  };
}

/**
 * The target that applies to a lead source. The account's CPL target is a
 * website-lead price: instant-form leads are cheaper and thinner, so judging
 * them against it would crown every form ad. Form ads are judged against the
 * account's own form-lead average instead.
 */
export function targetFor(channel: LeadChannel, metric: Metric, targets: { cpl: number | null; cpa: number | null }): number | null {
  if (metric === "appointments") return targets.cpa;
  return channel === "form" ? null : targets.cpl;
}

/** Which lead source to analyse by default: the one the account spends more on. */
export function dominantChannel(ads: CreativeAd[]): LeadChannel {
  const spend = (c: LeadChannel) => ads.filter((a) => a.leadChannel === c).reduce((s, a) => s + a.spend, 0);
  return spend("form") > spend("website") ? "form" : "website";
}
