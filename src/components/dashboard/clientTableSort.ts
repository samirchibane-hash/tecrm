// Sorting for the dashboard's Clients table. Numbers go through the shared
// sortByKpi, so unknown (Meta can't read the account, nothing linked) always
// sits last and a cost with spend but no result counts as the dearest.
import { costSortValue, sortByKpi, type SortDir } from "@/lib/kpiSort";

export type ClientSortKey = "account" | "spend" | "leads" | "cpl" | "appts" | "cpa" | "ads" | "budget";

export const CLIENT_SORT_KEYS: readonly ClientSortKey[] = ["account", "spend", "leads", "cpl", "appts", "cpa", "ads", "budget"];

/** Today's order: biggest spender first. */
export const DEFAULT_CLIENT_SORT: { key: ClientSortKey; dir: SortDir } = { key: "spend", dir: "desc" };

/** First click: names A → Z, every number highest first. */
export const firstSortDir = (key: ClientSortKey): SortDir => (key === "account" ? "asc" : "desc");

export interface ClientSortRow {
  name: string;
  /** Null when Meta couldn't read the account's spend. */
  spend: number | null;
  leads: number;
  appointments: number;
  activeAds: number | null;
  dailyBudget: number | null;
}

export function clientSortValue(row: ClientSortRow, key: Exclude<ClientSortKey, "account">): number | null {
  switch (key) {
    case "spend":
      return row.spend;
    case "leads":
      return row.leads;
    case "appts":
      return row.appointments;
    case "cpl":
      return row.spend === null ? null : costSortValue(row.spend, row.leads);
    case "cpa":
      return row.spend === null ? null : costSortValue(row.spend, row.appointments);
    case "ads":
      return row.activeAds;
    case "budget":
      return row.dailyBudget;
  }
}

export function sortClientRows<T>(
  rows: readonly T[],
  toSortRow: (row: T) => ClientSortRow,
  key: ClientSortKey,
  dir: SortDir,
): T[] {
  const byName = (a: T, b: T) => toSortRow(a).name.localeCompare(toSortRow(b).name);
  if (key === "account") {
    const sorted = [...rows].sort(byName);
    return dir === "asc" ? sorted : sorted.reverse();
  }
  return sortByKpi(rows, (r) => clientSortValue(toSortRow(r), key), dir, byName);
}
