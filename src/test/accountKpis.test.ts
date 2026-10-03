import { describe, it, expect } from "vitest";
import type { AdRow } from "@/hooks/useCouplerData";
import type { KpiKey } from "@/components/dashboard/AccountCard";
import {
  adRowsInRange,
  comparisonLabel,
  computeAccountKpis,
  ghlRowsInRange,
  kpiChange,
  previousPeriod,
  priorCoverage,
  type GhlKpiRow,
} from "@/lib/accountKpis";

function ad(date: string, over: Partial<AdRow> = {}): AdRow {
  return {
    "Account: Account name": "Acme",
    "Campaign: Campaign Id": "c1",
    "Campaign: Campaign name": "Leads",
    "Clicks: CTR": 0,
    "Cost: Amount spend": 0,
    "Cost: CPC": 0,
    "Cost: CPM": 0,
    "Performance: Clicks": 0,
    "Performance: Frequency": 0,
    "Performance: Impressions": 0,
    "Performance: Reach": 0,
    "Report: Date": date,
    "Report: End date": date,
    "Conversions: Website Appointments Scheduled - Total": null,
    "Conversions: Website Appointments Scheduled - Unique": null,
    "Conversions: Website Appointments Scheduled - Value": null,
    "Conversions: Website Appointments Scheduled - Cost": null,
    "Conversions: Website Appointments Scheduled - Unique Cost": null,
    "Conversions: Appointments Scheduled - Total": null,
    "Conversions: Appointments Scheduled - Unique": null,
    "Conversions: Appointments Scheduled - Value": null,
    "Conversions: Appointments Scheduled - Cost": null,
    "Conversions: Appointments Scheduled - Unique Cost": null,
    "Conversions: Leads - Total": null,
    "Conversions: Leads - Unique": null,
    "Conversions: Leads - Value": null,
    "Conversions: Leads - Cost": null,
    "Conversions: Leads - Unique Cost": null,
    "Conversions: All On-Facebook Leads - Total": null,
    "Conversions: All On-Facebook Leads - Unique": null,
    "Conversions: All On-Facebook Leads - Value": null,
    "Conversions: All On-Facebook Leads - Cost": null,
    "Conversions: All On-Facebook Leads - Unique Cost": null,
    ...over,
  };
}

const leads = (n: number, date = "2026-09-10"): GhlKpiRow[] =>
  Array.from({ length: n }, () => ({ type: "lead", created_on: date }));

const kpisWith = (over: Partial<Record<KpiKey, number>>) => ({ ...computeAccountKpis([], []), ...over });

describe("computeAccountKpis", () => {
  it("weights CTR, CPC and CPM by volume, the way Ads Manager reports them", () => {
    // A tiny day with a 10% CTR must not drag a big day's 1% CTR up to 5.5%.
    const rows = [
      ad("2026-09-01", { "Cost: Amount spend": 2, "Performance: Clicks": 1, "Performance: Impressions": 10, "Clicks: CTR": 10, "Cost: CPC": 2 }),
      ad("2026-09-02", { "Cost: Amount spend": 198, "Performance: Clicks": 99, "Performance: Impressions": 9990, "Clicks: CTR": 0.99, "Cost: CPC": 2 }),
    ];
    const k = computeAccountKpis(rows, []);
    expect(k.avgCTR).toBeCloseTo(1, 5);
    expect(k.avgCPC).toBeCloseTo(2, 5);
    expect(k.avgCPM).toBeCloseTo(20, 5);
  });

  it("counts a water test as both a lead and an appointment", () => {
    const k = computeAccountKpis([], [{ type: "lead", created_on: "2026-09-01" }, { type: "water test", created_on: "2026-09-01" }]);
    expect(k.ghlLeads).toBe(2);
    expect(k.ghlAppointments).toBe(1);
  });

  it("filters both feeds to the same inclusive day range", () => {
    const range = { from: new Date(2026, 8, 2), to: new Date(2026, 8, 3) };
    expect(adRowsInRange([ad("2026-09-01"), ad("2026-09-02"), ad("2026-09-03"), ad("2026-09-04")], range)).toHaveLength(2);
    expect(ghlRowsInRange([...leads(1, "2026-09-01"), ...leads(1, "2026-09-03")], range)).toHaveLength(1);
  });
});

describe("previousPeriod", () => {
  it("is the same number of days immediately before", () => {
    const prior = previousPeriod({ from: new Date(2026, 8, 1), to: new Date(2026, 8, 30) })!;
    expect(prior.from).toEqual(new Date(2026, 7, 2));
    expect(prior.to).toEqual(new Date(2026, 7, 31));
    expect(comparisonLabel(prior).short).toBe("vs prior 30d");
  });

  it("has no prior period for all time", () => {
    expect(previousPeriod(undefined)).toBeUndefined();
  });
});

describe("priorCoverage", () => {
  const now = new Date(2026, 9, 2);

  it("withholds Meta when the prior period predates coupler-proxy's 90-day window", () => {
    const inside = priorCoverage({ from: new Date(2026, 7, 2), to: new Date(2026, 7, 31) }, leads(1, "2026-01-01"), now);
    expect(inside.meta).toBe(true);
    const outside = priorCoverage({ from: new Date(2026, 5, 1), to: new Date(2026, 5, 30) }, leads(1, "2026-01-01"), now);
    expect(outside.meta).toBe(false);
    expect(outside.blended).toBe(false);
  });

  it("withholds GHL before the account's first synced conversion", () => {
    const c = priorCoverage({ from: new Date(2026, 7, 2), to: new Date(2026, 7, 31) }, leads(3, "2026-09-05"), now);
    expect(c.ghl).toBe(false);
    expect(c.meta).toBe(true);
    expect(c.blended).toBe(false);
  });
});

describe("kpiChange", () => {
  it("colours a cost falling as good news", () => {
    const c = kpiChange("ghlCostPerLead", kpisWith({ ghlCostPerLead: 30, ghlLeads: 40 }), kpisWith({ ghlCostPerLead: 40, ghlLeads: 30 }))!;
    expect(c.direction).toBe("down");
    expect(c.text).toBe("25%");
    expect(c.tone).toBe("success");
  });

  it("never judges spend moving", () => {
    const c = kpiChange("totalSpend", kpisWith({ totalSpend: 200 }), kpisWith({ totalSpend: 100 }))!;
    expect(c.direction).toBe("up");
    expect(c.tone).toBe("neutral");
  });

  it("shows small counts as a difference and does not call them good or bad", () => {
    const c = kpiChange("ghlLeads", kpisWith({ ghlLeads: 5 }), kpisWith({ ghlLeads: 2 }))!;
    expect(c.text).toBe("+3");
    expect(c.tone).toBe("neutral");
    expect(c.spoken).toMatch(/too few/);
  });

  it("does not colour a cost per lead resting on a handful of leads", () => {
    const c = kpiChange("ghlCostPerLead", kpisWith({ ghlCostPerLead: 50, ghlLeads: 3 }), kpisWith({ ghlCostPerLead: 100, ghlLeads: 2 }))!;
    expect(c.tone).toBe("neutral");
  });

  it("claims nothing when a ratio is undefined in either period", () => {
    expect(kpiChange("ghlCostPerLead", kpisWith({ ghlCostPerLead: 40, ghlLeads: 20 }), kpisWith({ ghlCostPerLead: 0 }))).toBeNull();
    expect(kpiChange("ghlLeads", kpisWith({ ghlLeads: 0 }), kpisWith({ ghlLeads: 0 }))).toBeNull();
  });

  it("reads a rise from nothing as 'from 0', not an infinite percent", () => {
    const c = kpiChange("totalSpend", kpisWith({ totalSpend: 300 }), kpisWith({ totalSpend: 0 }))!;
    expect(c.text).toBe("from 0");
  });
});
