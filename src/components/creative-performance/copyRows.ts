// The Copy view of the creative gallery: every headline or primary text the
// agency is running, pooled across ads (and across clients when the same words
// run for several dealers), so a line of copy is judged on all the money behind
// it rather than one ad at a time.
//
// Attribution is `breakdown`'s, not a new rule: an ad with one text credits it in
// full, an ad that rotates several is split with Meta's per-text breakdown, and
// a rotating ad Meta didn't split lands in a catch-all row instead of being
// credited to any one text. Ads under a tracking gap are left out by the caller:
// their zero leads are unknown, and would drag every text they use.

import { breakdown, type GroupRow } from "./breakdowns";
import { costSortValue } from "@/lib/kpiSort";
import type { KpiSortOption } from "@/lib/kpiSort";
import type { AssetRow, CreativeAd } from "./useCreativePerformance";
import type { Benchmark } from "./verdicts";

export type CopyKind = "headline" | "body";

export const COPY_NOUN: Record<CopyKind, { one: string; many: string; title: string }> = {
  headline: { one: "headline", many: "headlines", title: "Headlines" },
  body: { one: "primary text", many: "primary texts", title: "Primary text" },
};

/** Characters a headline shows in the feed before Meta truncates it (copywriter rule: ≤ 40). */
export const HEADLINE_FOLD = 40;
/** Characters of primary text shown before "See more" on a phone. */
export const BODY_FOLD = 125;

export interface CopyAdRef {
  ad: CreativeAd;
  accountId: string;
  accountName: string;
}

export interface CopyRow extends GroupRow {
  kind: CopyKind;
  /** The words as the homeowner sees them, line breaks kept (the group label collapses them). */
  text: string;
  /** Every ad that ran these words in the period, biggest spender first. */
  ads: CopyAdRef[];
  clients: { id: string; name: string }[];
  /** Ads running these words that are live right now. */
  live: number;
  /** Leads ÷ link clicks, in percent: does the promise hold up past the click. */
  clickToLead: number | null;
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
const keyOf = (s: string) => collapse(s).toLowerCase();

export function buildCopyRows(
  kind: CopyKind,
  refs: CopyAdRef[],
  assets: { headlines: AssetRow[]; bodies: AssetRow[] },
  benchmark: Benchmark | null,
): CopyRow[] {
  const byAd = new Map(refs.map((r) => [r.ad.id, r]));
  // The original words for each group key, so a primary text keeps its line
  // breaks and emoji layout on screen.
  const raw = new Map<string, string>();
  const remember = (t: string) => {
    const k = keyOf(t);
    if (k && !raw.has(k)) raw.set(k, t.trim());
  };
  for (const r of refs) for (const t of kind === "headline" ? r.ad.copy.headlines : r.ad.copy.bodies) remember(t);
  for (const a of kind === "headline" ? assets.headlines : assets.bodies) remember(a.text);

  const groups = breakdown(
    kind,
    refs.map((r) => r.ad),
    { metric: "leads", labels: new Map(), assets, pageLabel: (u) => u },
    benchmark,
    false,
  );

  return groups.map((g) => {
    const ads = g.adIds
      .map((id) => byAd.get(id))
      .filter((r): r is CopyAdRef => !!r)
      .sort((a, b) => b.ad.spend - a.ad.spend);
    const clients = [...new Map(ads.map((r) => [r.accountId, { id: r.accountId, name: r.accountName }])).values()];
    return {
      ...g,
      kind,
      text: g.catchAll ? g.label : raw.get(g.key) ?? g.label,
      ads,
      clients,
      live: ads.filter((r) => r.ad.live).length,
      clickToLead: g.linkClicks > 0 ? (g.results / g.linkClicks) * 100 : null,
    };
  });
}

/** The portfolio's pooled leads ÷ link clicks on these ads, in percent: the bar Click → lead is graded against. */
export function pooledClickToLead(rows: Pick<CopyRow, "results" | "linkClicks">[]): number | null {
  const clicks = rows.reduce((s, r) => s + r.linkClicks, 0);
  return clicks > 0 ? (rows.reduce((s, r) => s + r.results, 0) / clicks) * 100 : null;
}

export type CopySortKey = "spend" | "leads" | "costPer" | "appts" | "linkCtr" | "clickToLead" | "ads";

export const COPY_SORT_OPTIONS: KpiSortOption<CopySortKey>[] = [
  { key: "spend", label: "Spend", dir: "desc" },
  { key: "leads", label: "Leads", dir: "desc" },
  { key: "costPer", label: "Cost / lead", dir: "asc" },
  { key: "appts", label: "Appts", dir: "desc" },
  { key: "linkCtr", label: "Link CTR", dir: "desc" },
  { key: "clickToLead", label: "Click → lead", dir: "desc" },
  { key: "ads", label: "Ads using it", dir: "desc" },
];

export function copySortValue(r: CopyRow, key: CopySortKey): number | null {
  switch (key) {
    case "spend": return r.spend;
    case "leads": return r.results;
    case "costPer": return costSortValue(r.spend, r.results);
    case "appts": return r.appointments;
    case "linkCtr": return r.ctr;
    case "clickToLead": return r.clickToLead;
    case "ads": return r.ads.length;
  }
}

/** Split text at a fold: what shows in the feed, and what's hidden behind "See more" or truncation. */
export function splitAtFold(text: string, fold: number): { shown: string; hidden: string } {
  if (text.length <= fold) return { shown: text, hidden: "" };
  // Break on the last space before the fold so a word isn't cut in half.
  const cut = text.lastIndexOf(" ", fold);
  const at = cut > fold * 0.6 ? cut : fold;
  return { shown: text.slice(0, at), hidden: text.slice(at) };
}
