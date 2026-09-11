import type { CreativeAd } from "./useCreativePerformance";

export interface ResultTotal {
  type: string;
  label: string;
  count: number;
  spend: number;          // spend on the ads that count this result
  costPer: number | null; // null when count is 0 — no results is not "$0 each"
}

export interface CreativeSummary {
  live: number;
  delivered: number;
  spend: number;
  /** One entry per result type, biggest spend first. Types are never summed together. */
  results: ResultTotal[];
  /** Null when the account doesn't track appointments. */
  appointments: number | null;
  costPerAppointment: number | null;
}

/** `appointmentsTracked` comes from the account (a Schedule event in the last 90 days), not the ads. */
export function summarizeCreatives(ads: CreativeAd[], appointmentsTracked = false): CreativeSummary {
  const byType = new Map<string, ResultTotal>();
  for (const ad of ads) {
    if (!ad.result) continue;
    const t = byType.get(ad.result.type) ?? { type: ad.result.type, label: ad.result.label, count: 0, spend: 0, costPer: null };
    t.count += ad.result.count;
    t.spend += ad.spend;
    byType.set(ad.result.type, t);
  }
  const results = [...byType.values()]
    .map((t) => ({ ...t, costPer: t.count > 0 ? t.spend / t.count : null }))
    .sort((a, b) => b.spend - a.spend);

  const spend = ads.reduce((sum, a) => sum + a.spend, 0);
  const appointments = appointmentsTracked ? ads.reduce((sum, a) => sum + (a.appointments ?? 0), 0) : null;

  return {
    live: ads.filter((a) => a.live).length,
    delivered: ads.filter((a) => a.delivered).length,
    spend,
    results,
    appointments,
    costPerAppointment: appointments ? spend / appointments : null,
  };
}

export type CreativeSortKey = "spend" | "results" | "costPer" | "appointments" | "costPerAppt" | "linkCtr";

const sortValue: Record<CreativeSortKey, (ad: CreativeAd) => number | null> = {
  spend: (ad) => (ad.delivered ? ad.spend : null),
  results: (ad) => ad.result?.count ?? null,
  costPer: (ad) => ad.result?.costPer ?? null,
  appointments: (ad) => ad.appointments,
  costPerAppt: (ad) => ad.costPerAppointment,
  linkCtr: (ad) => ad.linkCtr,
};

/** Sorts by the chosen metric; ads with no value for it always sink to the bottom. */
export function sortCreatives(ads: CreativeAd[], key: CreativeSortKey, dir: "asc" | "desc"): CreativeAd[] {
  const get = sortValue[key];
  return [...ads].sort((a, b) => {
    const va = get(a);
    const vb = get(b);
    if (va === null && vb === null) return b.spend - a.spend;
    if (va === null) return 1;
    if (vb === null) return -1;
    return dir === "asc" ? va - vb : vb - va;
  });
}
