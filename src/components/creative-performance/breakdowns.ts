// Group ads by what they have in common (offer, angle, headline, primary text,
// format, ad set, landing page) and judge each group the same way single ads
// are judged, so "Financing beats Free water test" is a tested claim.
//
// Headlines and primary texts: an ad that rotates several texts is split per
// text with Meta's asset breakdown. When Meta has no split for such an ad its
// numbers go to a "Rotating … (not split)" row rather than being credited to
// any one text.

import { normalizePageUrl } from "@/lib/urls";
import { labelCreative, ANGLE_LABEL, OFFER_LABEL, type CreativeLabels } from "./labels";
import { judge, resultsFor, type Benchmark, type Judgement, type Metric } from "./verdicts";
import type { AssetRow, CreativeAd } from "./useCreativePerformance";

export type Dimension = "offer" | "angle" | "headline" | "body" | "format" | "adset" | "landing_page";

export const DIMENSIONS: { value: Dimension; label: string }[] = [
  { value: "offer", label: "Offer" },
  { value: "angle", label: "Angle" },
  { value: "headline", label: "Headline" },
  { value: "body", label: "Primary text" },
  { value: "format", label: "Format" },
  { value: "adset", label: "Ad set" },
  { value: "landing_page", label: "Landing page" },
];

const MULTIPLE = "__multiple__";
const NONE = "__none__";

interface Unit {
  key: string;
  label: string;
  adId: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  results: number;
  appointments: number | null;
  fromAsset: boolean;
}

export interface GroupRow extends Judgement {
  key: string;
  label: string;
  /** True for the catch-all rows (rotating texts Meta didn't split, no headline, …). */
  catchAll: boolean;
  adIds: string[];
  spend: number;
  share: number;          // of the analysed spend
  impressions: number;
  linkClicks: number;
  ctr: number | null;     // percent units, like Meta's
  results: number;
  appointments: number | null;
  costPerAppt: number | null;
  /** Some of this row's numbers come from Meta's per-text asset breakdown. */
  fromAssets: boolean;
}

export interface BreakdownContext {
  metric: Metric;
  labels: Map<string, CreativeLabels>;
  assets: { headlines: AssetRow[] | null; bodies: AssetRow[] | null } | null;
  /** Display name for a normalized landing page URL. */
  pageLabel: (normalizedUrl: string) => string;
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

function adUnit(ad: CreativeAd, key: string, label: string, metric: Metric): Unit {
  return {
    key,
    label,
    adId: ad.id,
    spend: ad.spend,
    impressions: ad.impressions,
    linkClicks: ad.linkClicks,
    results: resultsFor(ad, metric),
    appointments: ad.appointments,
    fromAsset: false,
  };
}

function textUnits(ad: CreativeAd, texts: string[], rows: AssetRow[] | undefined, noun: string, metric: Metric): Unit[] {
  if (rows && rows.length > 0) {
    return rows.map((r) => ({
      key: collapse(r.text).toLowerCase(),
      label: collapse(r.text),
      adId: ad.id,
      spend: r.spend,
      impressions: r.impressions,
      linkClicks: r.linkClicks,
      results: metric === "appointments" ? r.appointments ?? 0 : ad.leadChannel === "form" ? r.formLeads : r.webLeads,
      appointments: r.appointments,
      fromAsset: true,
    }));
  }
  if (texts.length === 1) return [adUnit(ad, collapse(texts[0]).toLowerCase(), collapse(texts[0]), metric)];
  if (texts.length === 0) return [adUnit(ad, NONE, `No ${noun}`, metric)];
  return [adUnit(ad, MULTIPLE, `Rotating ${noun}s (Meta didn't split)`, metric)];
}

export function landingPageKey(ad: CreativeAd): string {
  const urls = [...new Set(ad.copy.destinationUrls.map(normalizePageUrl))];
  if (urls.length === 1) return urls[0];
  return urls.length === 0 ? NONE : MULTIPLE;
}

function unitsFor(dim: Dimension, ads: CreativeAd[], ctx: BreakdownContext): Unit[] {
  const { metric } = ctx;
  const byAd = (rows: AssetRow[] | null | undefined) => {
    const m = new Map<string, AssetRow[]>();
    for (const r of rows ?? []) m.set(r.adId, [...(m.get(r.adId) ?? []), r]);
    return m;
  };

  switch (dim) {
    case "offer":
    case "angle":
      return ads.map((ad) => {
        const l = ctx.labels.get(ad.id) ?? labelCreative(ad);
        return dim === "offer"
          ? adUnit(ad, l.offer, OFFER_LABEL[l.offer], metric)
          : adUnit(ad, l.angle, ANGLE_LABEL[l.angle], metric);
      });
    case "format":
      return ads.map((ad) => adUnit(ad, ad.format, ad.format === "video" ? "Video" : "Image", metric));
    case "adset":
      return ads.map((ad) => adUnit(ad, ad.adsetId ?? ad.adset ?? NONE, ad.adset ?? "Unknown ad set", metric));
    case "landing_page":
      return ads.map((ad) => {
        const key = landingPageKey(ad);
        const label =
          key === NONE ? (ad.leadChannel === "form" ? "Instant form (no page)" : "No landing page found")
          : key === MULTIPLE ? "Several pages (Meta didn't split)"
          : ctx.pageLabel(key);
        return adUnit(ad, key, label, metric);
      });
    case "headline": {
      const rows = byAd(ctx.assets?.headlines);
      return ads.flatMap((ad) => textUnits(ad, ad.copy.headlines, rows.get(ad.id), "headline", metric));
    }
    case "body": {
      const rows = byAd(ctx.assets?.bodies);
      return ads.flatMap((ad) => textUnits(ad, ad.copy.bodies, rows.get(ad.id), "primary text", metric));
    }
  }
}

export function breakdown(
  dim: Dimension,
  ads: CreativeAd[],
  ctx: BreakdownContext,
  benchmark: Benchmark | null,
  trackingGap: boolean,
): GroupRow[] {
  const delivered = ads.filter((a) => a.delivered && a.spend > 0);
  const units = unitsFor(dim, delivered, ctx);
  const total = units.reduce((s, u) => s + u.spend, 0);

  const groups = new Map<string, Unit[]>();
  for (const u of units) groups.set(u.key, [...(groups.get(u.key) ?? []), u]);

  return [...groups.entries()]
    .map(([key, us]) => {
      const spend = us.reduce((s, u) => s + u.spend, 0);
      const impressions = us.reduce((s, u) => s + u.impressions, 0);
      const linkClicks = us.reduce((s, u) => s + u.linkClicks, 0);
      const results = us.reduce((s, u) => s + u.results, 0);
      const apptTracked = us.every((u) => u.appointments !== null);
      const appointments = apptTracked ? us.reduce((s, u) => s + (u.appointments ?? 0), 0) : null;
      return {
        key,
        label: us[0].label,
        catchAll: key === MULTIPLE || key === NONE,
        adIds: [...new Set(us.map((u) => u.adId))],
        spend,
        share: total > 0 ? spend / total : 0,
        impressions,
        linkClicks,
        ctr: impressions > 0 ? (linkClicks / impressions) * 100 : null,
        results,
        appointments,
        costPerAppt: appointments ? spend / appointments : null,
        fromAssets: us.some((u) => u.fromAsset),
        ...judge({ spend, results }, benchmark, ctx.metric, { trackingGap }),
      };
    })
    .sort((a, b) => Number(a.catchAll) - Number(b.catchAll) || b.spend - a.spend);
}
