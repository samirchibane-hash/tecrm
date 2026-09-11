import { describe, expect, it } from "vitest";
import { sortCreatives, summarizeCreatives } from "@/components/creative-performance/summarize";
import type { CreativeResult, LiveAd } from "@/components/creative-performance/useCreativePerformance";

const result = (type: string, count: number, costPer: number | null): CreativeResult => ({
  type,
  label: type === "lead_grouped" ? "Form leads" : "Website leads",
  count,
  costPer,
  source: "meta",
});

const ad = (name: string, spend: number, r: CreativeResult | null, delivered = true, linkCtr: number | null = 1): LiveAd => ({
  id: name,
  name,
  createdTime: "2026-09-01T00:00:00Z",
  campaign: null,
  adset: null,
  optimizationGoal: null,
  format: "image",
  thumbnailUrl: null,
  adsManagerUrl: "",
  delivered,
  spend,
  impressions: 0,
  linkCtr,
  result: r,
});

describe("summarizeCreatives", () => {
  it("keeps result types separate instead of summing leads with form leads", () => {
    const s = summarizeCreatives([
      ad("a", 745.08, result("pixel_lead", 25, 29.8)),
      ad("b", 697.15, result("pixel_lead", 12, 58.1)),
      ad("c", 296.25, result("lead_grouped", 27, 10.97)),
    ]);
    expect(s.results).toHaveLength(2);
    expect(s.results[0]).toMatchObject({ type: "pixel_lead", count: 37 });
    expect(s.results[0].costPer).toBeCloseTo((745.08 + 697.15) / 37);
    expect(s.results[1]).toMatchObject({ type: "lead_grouped", count: 27 });
  });

  it("reports no cost per result when a type has zero results, never $0", () => {
    const s = summarizeCreatives([ad("a", 113.75, result("schedule", 0, null)), ad("b", 86.84, result("schedule", 0, null))]);
    expect(s.results[0].count).toBe(0);
    expect(s.results[0].costPer).toBeNull();
    expect(s.spend).toBeCloseTo(200.59);
  });

  it("counts live vs delivered ads and leaves result-less ads out of the totals", () => {
    const s = summarizeCreatives([ad("a", 10, null), ad("b", 0, null, false)]);
    expect(s).toMatchObject({ live: 2, delivered: 1, results: [] });
  });
});

describe("sortCreatives", () => {
  const ads = [
    ad("cheap", 20, result("pixel_lead", 4, 5)),
    ad("none", 50, result("pixel_lead", 0, null)),
    ad("pricey", 100, result("pixel_lead", 2, 50)),
    ad("idle", 0, null, false, null),
  ];

  it("sorts cost per result ascending with no-result ads last", () => {
    expect(sortCreatives(ads, "costPer", "asc").map((a) => a.name)).toEqual(["cheap", "pricey", "none", "idle"]);
  });

  it("sorts spend descending with undelivered ads last", () => {
    expect(sortCreatives(ads, "spend", "desc").map((a) => a.name)).toEqual(["pricey", "none", "cheap", "idle"]);
  });
});
