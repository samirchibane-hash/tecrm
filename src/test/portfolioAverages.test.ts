import { describe, expect, it } from "vitest";
import { kpiVsPortfolio, portfolioAverages } from "@/lib/portfolioAverages";
import { portfolioCostPer } from "@/components/creative-performance/verdicts";
import type { AdRow } from "@/hooks/useCouplerData";
import { makeAd } from "./fixtures";

const row = (name: string, spend: number, clicks = 0, impressions = 0) =>
  ({ "Account: Account name": name, "Report: Date": "2026-10-03", "Cost: Amount spend": spend, "Performance: Clicks": clicks, "Performance: Impressions": impressions }) as unknown as AdRow;
const leads = (n: number, appts = 0) => [
  ...Array.from({ length: n - appts }, () => ({ type: "lead", created_on: "2026-10-03" })),
  ...Array.from({ length: appts }, () => ({ type: "water test", created_on: "2026-10-03" })),
];

describe("portfolio averages", () => {
  const avgs = portfolioAverages([
    { adRows: [row("Meridian", 902, 300, 30000)], ghl: leads(6, 1), spendKnown: true },
    { adRows: [row("Naples", 438, 100, 20000)], ghl: leads(1, 1), spendKnown: true },
    // Spend with no GHL lead is an unmapped account, not a real zero: kept out of CPL.
    { adRows: [row("Rochester", 268, 50, 5000)], ghl: [], spendKnown: true },
  ]);

  it("pools cost per lead like the dashboard: spend ÷ leads over clients with leads", () => {
    expect(avgs.values.ghlCostPerLead).toBeCloseTo((902 + 438) / 7);
    expect(avgs.clients).toBe(2);
  });

  it("pools Meta ratios over every known-spend client, weighted", () => {
    expect(avgs.values.avgCPC).toBeCloseTo((902 + 438 + 268) / 450);
  });

  it("reads a KPI against the average with direction and distance", () => {
    expect(kpiVsPortfolio("ghlCostPerLead", 438, avgs)).toEqual({ status: "danger", text: "129% above portfolio avg" });
    expect(kpiVsPortfolio("ghlCostPerLead", 220, avgs)!.status).toBe("warning");
    expect(kpiVsPortfolio("ghlCostPerLead", 150, avgs)!.status).toBe("success");
    expect(kpiVsPortfolio("totalSpend", 902, avgs)).toBeNull(); // size isn't skill
    expect(kpiVsPortfolio("ghlCostPerLead", 0, avgs)).toBeNull(); // no leads: no cost to judge
  });
});

describe("portfolio cost per lead for creative verdicts", () => {
  const acct = (name: string, ads: ReturnType<typeof makeAd>[], error = null) => ({ accountName: name, accountId: name, ads, error });
  it("pools website ads across clients and leaves out accounts with no result, errors and hidden ones", () => {
    const bar = portfolioCostPer([
      acct("A", [makeAd({ spend: 400, webLeads: 4, leadChannel: "website" })]),
      acct("B", [makeAd({ spend: 200, webLeads: 1, leadChannel: "website" }), makeAd({ spend: 50, formLeads: 10, leadChannel: "form" })]),
      acct("C", [makeAd({ spend: 300, webLeads: 0, leadChannel: "website" })]),
      acct("H", [makeAd({ spend: 999, webLeads: 1, leadChannel: "website" })]),
    ], "website", "leads", ["H"]);
    expect(bar).toEqual({ costPer: 600 / 5, source: "portfolio" });
  });
});
