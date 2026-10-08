// What the Creatives gallery can sort on, and the value each ad sorts by.
import { costSortValue, type KpiSortOption } from "@/lib/kpiSort";
import { hookRate, type ScoredAd } from "./verdicts";

export type SortKey = "spend" | "leads" | "costPer" | "appts" | "linkCtr" | "hook" | "frequency";

export const SORT_OPTIONS: KpiSortOption<SortKey>[] = [
  { key: "spend", label: "Spend", dir: "desc" },
  { key: "leads", label: "Leads", dir: "desc" },
  { key: "costPer", label: "Cost / lead", dir: "asc" },
  { key: "appts", label: "Appts", dir: "desc" },
  { key: "linkCtr", label: "Link CTR", dir: "desc" },
  { key: "hook", label: "Hook rate", dir: "desc" },
  { key: "frequency", label: "Frequency", dir: "desc" },
];

/**
 * The value an ad sorts on, or null when it's unknown (sorted last either way).
 * An ad that didn't deliver has no KPIs at all, and under a tracking gap its
 * zero leads are unknown, not zero, so they never top a "fewest leads" sort.
 */
export function adSortValue(r: Pick<ScoredAd, "ad" | "results"> & { trackingGap: boolean }, key: SortKey): number | null {
  const { ad } = r;
  if (key === "spend") return ad.spend;
  if (!ad.delivered) return null;
  switch (key) {
    case "leads": return r.trackingGap ? null : r.results;
    case "costPer": return r.trackingGap ? null : costSortValue(ad.spend, r.results);
    case "appts": return ad.appointments;
    case "linkCtr": return ad.linkCtr;
    case "hook": return ad.format === "video" ? hookRate(ad) : null;
    case "frequency": return ad.frequency;
  }
}
