import { describe, expect, it } from "vitest";
import { costStatus, portfolioBenchmark, rateStatus } from "@/components/dashboard/portfolioBenchmark";

const client = (spend: number, leads: number, appointments = 0, spendKnown = true) => ({ spend, spendKnown, leads, appointments });

describe("portfolioBenchmark", () => {
  it("weights by volume: total spend over total results, not a mean of ratios", () => {
    // Mean of CPLs would be (20 + 400) / 2 = 210; pooled is 1600 / 61.
    const b = portfolioBenchmark([client(1200, 60), client(400, 1)]);
    expect(b.cpl).toBeCloseTo(1600 / 61);
    expect(b.cplClients).toBe(2);
  });

  it("leaves out spend with no GHL results, unknown spend, and idle clients", () => {
    const b = portfolioBenchmark([client(1000, 25), client(800, 0), client(500, 10, 0, false), client(0, 3)]);
    expect(b.cpl).toBe(40);
    expect(b.cplClients).toBe(1);
  });

  it("pools appointments separately from leads", () => {
    const b = portfolioBenchmark([client(1000, 20, 5), client(1000, 30, 0)]);
    expect(b.cpl).toBe(40);
    expect(b.cpa).toBe(200);
    expect(b.cpaClients).toBe(1);
  });

  it("has no bar when nobody qualifies", () => {
    expect(portfolioBenchmark([client(500, 0)])).toEqual({ cpl: null, cpa: null, cplClients: 0, cpaClients: 0 });
  });
});

describe("costStatus", () => {
  it("bands at the average and 25% over it", () => {
    expect(costStatus(40, 40)).toBe("success");
    expect(costStatus(50, 40)).toBe("warning");
    expect(costStatus(51, 40)).toBe("danger");
    expect(costStatus(40, null)).toBeNull();
    expect(costStatus(0, 40)).toBeNull();
  });
});

describe("rateStatus", () => {
  it("reads a rate against the portfolio average, higher is better", () => {
    expect(rateStatus(0.054, 0.046)).toBe("success"); // Meridian 1: 6 leads on 111 views
    expect(rateStatus(0.04, 0.046)).toBe("warning");
    expect(rateStatus(0.015, 0.046)).toBe("danger"); // Naples 1: 1 lead on 67 views
    expect(rateStatus(null, 0.046)).toBeNull();
    expect(rateStatus(0.05, null)).toBeNull();
  });
});
