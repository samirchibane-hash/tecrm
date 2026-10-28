import { describe, expect, it } from "vitest";
import { buildFunnelsBoard, type FunnelRow } from "@/components/funnels/funnelRows";
import { buildTemplateBoard } from "@/components/funnels/templateRows";
import type { FunnelPageCopy } from "@/components/funnel/portfolioFunnel";
import type { FunnelTemplate } from "@/components/funnels/useFunnelsData";

const link = (account: string, url: string, template: string | null): FunnelPageCopy => ({
  account_name: account,
  url,
  label: url.split("/").pop()!,
  page_title: null,
  page_headline: null,
  page_subhead: null,
  page_cta: null,
  copy_synced_at: "2026-10-01T00:00:00Z",
  template_key: template,
});

const templates: FunnelTemplate[] = [
  { key: "short", name: "Short page", description: "", sections: ["hero", "benefits", "reviews", "cta"], status: "active" },
  { key: "long_form", name: "Long-form", description: "", sections: ["hero", "agitation", "cta"], status: "active" },
];

const links = [
  // HQWA: okc-1 is a router over two short arms; tempe-2 is long-form.
  link("HQWA", "https://new.hqwa.co/okc-1", null),
  link("HQWA", "https://new.hqwa.co/okc-1-a", "short"),
  link("HQWA", "https://new.hqwa.co/okc-1-b", "short"),
  link("HQWA", "https://new.hqwa.co/tempe-2", "long_form"),
  // Tarheel: a short page only.
  link("Tarheel", "https://test.tarheel.com/wilmington-1", "short"),
  // A page on a skeleton the sync doesn't know.
  link("Tarheel", "https://test.tarheel.com/quiz-1", null),
];

const board = () => buildFunnelsBoard({ links, pages: [], portfolio: [], versions: [], tests: [], variantDays: [] });

describe("buildFunnelsBoard templates", () => {
  it("gives a router its arms' template and marks arms with their router", () => {
    const rows = board().rows;
    const okc = rows.find((r) => r.url.endsWith("/okc-1"))!;
    expect(okc.templateKey).toBe("short");
    expect(okc.armOf).toBeNull();
    expect(rows.find((r) => r.url.endsWith("/okc-1-a"))!.armOf).toBe(okc.key);
  });
});

describe("buildTemplateBoard", () => {
  it("lists each page once, under its template and client, with arms folded in", () => {
    const { groups, unmatched } = buildTemplateBoard(board().rows, templates, { minViews: 200 });
    const short = groups.find((g) => g.template.key === "short")!;
    expect(short.clients.map((c) => c.accountName)).toEqual(["HQWA", "Tarheel"]);
    expect(short.clients[0].pages.map((p) => p.label)).toEqual(["okc-1"]);
    expect(short.pages).toBe(2);

    const long = groups.find((g) => g.template.key === "long_form")!;
    expect(long.clients.map((c) => c.accountName)).toEqual(["HQWA"]);
    expect(long.notBuilt).toEqual(["Tarheel"]);
    expect(unmatched.map((r) => r.label)).toEqual(["quiz-1"]);
  });

  it("calls a client live only when a page on the template had traffic", () => {
    const rows = board().rows.map((r): FunnelRow =>
      r.url.endsWith("/okc-1") ? { ...r, perf: { spend: 300, lpv: 400 } as FunnelRow["perf"], verifiedLeads: 20 } : r);
    const short = buildTemplateBoard(rows, templates, { minViews: 200 }).groups[0];
    expect(short.clients.map((c) => [c.accountName, c.status])).toEqual([["HQWA", "live"], ["Tarheel", "built"]]);
    expect(short.liveClients).toBe(1);
    expect(short.builtClients).toBe(1);
    expect(short.cvr).toBeCloseTo(0.05);
  });

  it("withholds the pooled rate under the view floor", () => {
    const rows = board().rows.map((r): FunnelRow =>
      r.url.endsWith("/okc-1") ? { ...r, perf: { spend: 30, lpv: 50 } as FunnelRow["perf"], verifiedLeads: 3 } : r);
    const short = buildTemplateBoard(rows, templates, { minViews: 200 }).groups[0];
    expect(short.cvr).toBeNull();
    expect(short.views).toBe(50);
  });
});
