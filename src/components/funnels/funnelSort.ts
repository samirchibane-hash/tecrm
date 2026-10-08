// What the Funnels board can sort on, and the value each page sorts by.
//
// No cost per lead here on purpose: the board shows no page verdict, and cost
// per lead is an ad question that /creatives sorts on (crm/CLAUDE.md).
import type { KpiSortOption } from "@/lib/kpiSort";
import type { FunnelRow } from "./funnelRows";

export type FunnelSortKey = "client" | "spend" | "views" | "leads" | "cvr" | "appts" | "bookedRate";

export const FUNNEL_SORT_OPTIONS: KpiSortOption<FunnelSortKey>[] = [
  { key: "client", label: "Client", dir: "asc" },
  { key: "spend", label: "Spend", dir: "desc" },
  { key: "views", label: "Views", dir: "desc" },
  { key: "leads", label: "Leads", dir: "desc" },
  { key: "cvr", label: "Conversion", dir: "desc" },
  { key: "appts", label: "Appts", dir: "desc" },
  { key: "bookedRate", label: "Lead → appt", dir: "desc" },
];

/**
 * The value a page sorts by, or null when unknown (sorted last either way).
 * A page with no ad traffic spent $0 on 0 views, which are real amounts; its
 * leads and rates are unknown, as they are for a client not yet attributed.
 */
export function funnelSortValue(r: FunnelRow, key: Exclude<FunnelSortKey, "client">): number | null {
  switch (key) {
    case "spend": return r.perf?.spend ?? 0;
    case "views": return r.perf?.lpv ?? 0;
    case "leads": return r.verifiedLeads;
    case "cvr": return r.verifiedCvr;
    case "appts": return r.verifiedBooked;
    case "bookedRate": return r.bookedRate;
  }
}
