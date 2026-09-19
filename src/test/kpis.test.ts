import { describe, it, expect } from "vitest";
import { resolveChartKpi } from "@/lib/kpis";
import { dependsOnMeta, type KpiKey } from "@/components/dashboard/AccountCard";

const CHARTABLE = new Set<KpiKey>([
  "totalSpend", "totalClicks", "totalImpressions", "totalReach",
  "avgCTR", "avgCPC", "avgCPM",
  "webApptTotal", "apptTotal",
  "ghlLeads", "ghlAppointments", "ghlCostPerLead", "ghlCostPerAppt",
]);

const chartableWhen = (metaDown: boolean) => (key: KpiKey) =>
  CHARTABLE.has(key) && !(metaDown && dependsOnMeta(key));

// A typical enabled-KPI order: Meta metrics first, GHL after.
const ENABLED: KpiKey[] = [
  "totalSpend", "avgCPC", "ghlCostPerLead", "ghlLeads", "ghlAppointments", "totalRevenue",
];

describe("dependsOnMeta", () => {
  it("flags Meta-sourced KPIs", () => {
    expect(dependsOnMeta("totalSpend")).toBe(true);
    expect(dependsOnMeta("avgCTR")).toBe(true);
  });

  it("flags blended KPIs — they divide Meta spend by GHL volume", () => {
    expect(dependsOnMeta("ghlCostPerLead")).toBe(true);
    expect(dependsOnMeta("ghlCostPerAppt")).toBe(true);
    expect(dependsOnMeta("adRoi")).toBe(true);
  });

  it("leaves pure GHL KPIs alone", () => {
    expect(dependsOnMeta("ghlLeads")).toBe(false);
    expect(dependsOnMeta("ghlAppointments")).toBe(false);
    expect(dependsOnMeta("soldCount")).toBe(false);
    expect(dependsOnMeta("totalRevenue")).toBe(false);
  });
});

describe("resolveChartKpi", () => {
  it("keeps the user's selection while Meta is healthy", () => {
    expect(resolveChartKpi("totalSpend", ENABLED, chartableWhen(false))).toBe("totalSpend");
  });

  it("falls back to the first live KPI when Meta is down", () => {
    // Spend, Avg CPC and Cost/GHL Lead all need Meta — GHL Leads is the first that doesn't.
    expect(resolveChartKpi("totalSpend", ENABLED, chartableWhen(true))).toBe("ghlLeads");
  });

  it("does not disturb a GHL selection when Meta is down", () => {
    expect(resolveChartKpi("ghlAppointments", ENABLED, chartableWhen(true))).toBe("ghlAppointments");
  });

  it("restores the original selection once Meta reconnects", () => {
    const selected: KpiKey = "totalSpend";
    expect(resolveChartKpi(selected, ENABLED, chartableWhen(true))).toBe("ghlLeads");
    expect(resolveChartKpi(selected, ENABLED, chartableWhen(false))).toBe("totalSpend");
  });

  it("skips enabled KPIs that have no time series at all", () => {
    // soldCount is GHL-backed but not chartable, so it must not be picked.
    expect(resolveChartKpi("totalSpend", ["totalSpend", "soldCount", "ghlLeads"], chartableWhen(true)))
      .toBe("ghlLeads");
  });

  it("returns undefined when nothing is chartable", () => {
    expect(resolveChartKpi("totalSpend", ["totalSpend", "avgCPC"], chartableWhen(true))).toBeUndefined();
  });
});
