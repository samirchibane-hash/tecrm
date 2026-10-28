// The Templates tab: the same funnel rows as the Pages tab, grouped by the
// landing-page template each page is built on, then by client.
//
// It is a grouping of FunnelsBoard's rows, never a second computation: a page's
// numbers, its test and its arms are exactly what the Pages tab shows. Arm
// pages (okc-1-a) fold into their router (okc-1), whose split test already
// carries every arm, so a test is listed once.

import type { FunnelRow } from "./funnelRows";
import type { FunnelTemplate } from "./useFunnelsData";

/**
 * live: a page on this template had ad traffic in the period.
 * built: the client has a page on it, idle in the period.
 */
export type TemplateClientStatus = "live" | "built";

export interface TemplateClient {
  accountName: string;
  status: TemplateClientStatus;
  /** Routers and standalone pages on this template, biggest spender first. */
  pages: FunnelRow[];
  runningTests: number;
}

export interface TemplateGroup {
  template: FunnelTemplate;
  clients: TemplateClient[];
  /** Clients on the board with no page on this template: where it could be ported. */
  notBuilt: string[];
  liveClients: number;
  builtClients: number;
  pages: number;
  runningTests: number;
  /**
   * Attributed leads ÷ page views, pooled over this template's measured pages.
   * Pooling mixes markets and offers, so it is a lead for the next test, never
   * a verdict; null under `minViews` (it reads "Needs traffic").
   */
  cvr: number | null;
  views: number;
  leads: number;
  measuredPages: number;
}

export interface TemplateBoard {
  groups: TemplateGroup[];
  /** Entry pages the sync couldn't match to any template (a new skeleton). */
  unmatched: FunnelRow[];
}

export function buildTemplateBoard(
  rows: FunnelRow[],
  templates: FunnelTemplate[],
  { minViews }: { minViews: number },
): TemplateBoard {
  const pages = rows.filter((r) => !r.armOf);
  const allClients = [...new Set(rows.map((r) => r.accountName))].sort((a, b) => a.localeCompare(b));

  const groups = templates.map((template): TemplateGroup => {
    const onTemplate = pages.filter((r) => r.templateKey === template.key);
    const byClient = new Map<string, FunnelRow[]>();
    for (const r of onTemplate) byClient.set(r.accountName, [...(byClient.get(r.accountName) ?? []), r]);

    const clients = [...byClient].map(([accountName, list]): TemplateClient => ({
      accountName,
      status: list.some((r) => r.perf) ? "live" : "built",
      pages: [...list].sort((a, b) => (b.perf?.spend ?? -1) - (a.perf?.spend ?? -1) || a.label.localeCompare(b.label)),
      runningTests: list.filter((r) => r.runningTest).length,
    }));
    // Live first, then by the money behind them, then by name.
    const spendOf = (c: TemplateClient) => c.pages.reduce((s, r) => s + (r.perf?.spend ?? 0), 0);
    clients.sort((a, b) =>
      (a.status === b.status ? 0 : a.status === "live" ? -1 : 1) || spendOf(b) - spendOf(a) || a.accountName.localeCompare(b.accountName));

    // Same measured set as the board's own average: pages with traffic whose
    // client sends attribution. Unmeasured views never dilute the rate.
    const measured = onTemplate.filter((r) => r.perf && r.verifiedLeads !== null);
    const views = measured.reduce((s, r) => s + (r.perf?.lpv ?? 0), 0);
    const leads = measured.reduce((s, r) => s + (r.verifiedLeads ?? 0), 0);

    return {
      template,
      clients,
      notBuilt: allClients.filter((c) => !byClient.has(c)),
      liveClients: clients.filter((c) => c.status === "live").length,
      builtClients: clients.filter((c) => c.status === "built").length,
      pages: onTemplate.length,
      runningTests: clients.reduce((s, c) => s + c.runningTests, 0),
      cvr: views >= minViews && views > 0 ? leads / views : null,
      views,
      leads,
      measuredPages: measured.length,
    };
  });

  return {
    groups,
    unmatched: pages.filter((r) => !r.templateKey || !templates.some((t) => t.key === r.templateKey)),
  };
}
