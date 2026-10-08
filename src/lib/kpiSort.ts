// Sort a list by one KPI, shared by the Creatives gallery and the Funnels board.
//
// Three states, kept apart (design rule #5):
// - a number sorts by value;
// - Infinity is "spent with no result": a cost per lead that is worse than any
//   priced one, so it sits after them cheapest-first and before them dearest-first;
// - null is unknown (not tracked, no delivery, an image ad's hook rate) and always
//   sits last, whichever way the list is sorted. Unknown is neither best nor worst.

export type SortDir = "asc" | "desc";

export interface KpiSortOption<K extends string> {
  key: K;
  label: string;
  /** The way the KPI is first sorted when picked: costs cheapest first, everything else highest first. */
  dir: SortDir;
}

export function sortByKpi<T>(
  items: readonly T[],
  value: (item: T) => number | null,
  dir: SortDir,
  tiebreak: (a: T, b: T) => number = () => 0,
): T[] {
  return items
    .map((item) => ({ item, v: value(item) }))
    .sort((a, b) => {
      const an = a.v === null || Number.isNaN(a.v);
      const bn = b.v === null || Number.isNaN(b.v);
      if (an || bn) return an === bn ? tiebreak(a.item, b.item) : an ? 1 : -1;
      if (a.v === b.v) return tiebreak(a.item, b.item);
      const asc = a.v! < b.v! ? -1 : 1;
      return dir === "asc" ? asc : -asc;
    })
    .map((x) => x.item);
}

/** Cost per result for sorting: Infinity when money went out and nothing came back, null when unknown. */
export function costSortValue(spend: number, results: number | null): number | null {
  if (results === null) return null;
  if (results > 0) return spend / results;
  return spend > 0 ? Infinity : null;
}
