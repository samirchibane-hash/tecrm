import type { KpiKey } from "@/components/dashboard/AccountCard";
import type { AdRow } from "@/hooks/useCouplerData";
import { costStatus, portfolioBenchmark, rateStatus } from "@/components/dashboard/portfolioBenchmark";
import type { CostStatus } from "@/components/dashboard/CostVsTarget";
import { computeAccountKpis, type GhlKpiRow } from "./accountKpis";

/** One client's period: its Meta rows, its GHL contacts, and whether Meta could read its spend. */
export interface ClientPeriod {
  adRows: readonly AdRow[];
  ghl: readonly GhlKpiRow[];
  spendKnown: boolean;
}

/** KPIs read against the portfolio, and which way is good. Counts (spend, leads, reach) aren't: size isn't skill. */
const DIRECTION: Partial<Record<KpiKey, "lower" | "higher">> = {
  ghlCostPerLead: "lower",
  ghlCostPerAppt: "lower",
  avgCPC: "lower",
  avgCPM: "lower",
  webApptCost: "lower",
  apptCost: "lower",
  avgCTR: "higher",
};

export interface PortfolioAverages {
  /** The pooled value per comparable KPI; absent when no client qualifies. */
  values: Partial<Record<KpiKey, number>>;
  /** Clients pooled into the cost-per-lead average, for the caption. */
  clients: number;
}

/**
 * The portfolio's own value of every comparable KPI for one period: the bar the
 * account page reads each client against instead of manual targets (Samir,
 * 2026-10-07). Cost per lead / appt pool exactly like the dashboard table
 * (`portfolioBenchmark`: spend ÷ results across clients with known spend and at
 * least one result). Meta ratios (CTR, CPC, CPM, Meta appt cost) pool every
 * known-spend client's rows into one Ads-Manager-weighted figure.
 */
export function portfolioAverages(clients: readonly ClientPeriod[]): PortfolioAverages {
  const kpis = clients.map((c) => ({ ...c, k: computeAccountKpis(c.adRows, c.ghl) }));
  const bench = portfolioBenchmark(
    kpis.map((c) => ({ spend: c.k.totalSpend, spendKnown: c.spendKnown, leads: c.k.ghlLeads, appointments: c.k.ghlAppointments })),
  );
  const known = kpis.filter((c) => c.spendKnown && c.k.totalSpend > 0);
  const pooled = computeAccountKpis(known.flatMap((c) => c.adRows), []);
  const values: Partial<Record<KpiKey, number>> = {};
  if (bench.cpl !== null) values.ghlCostPerLead = bench.cpl;
  if (bench.cpa !== null) values.ghlCostPerAppt = bench.cpa;
  for (const key of ["avgCPC", "avgCPM", "avgCTR", "webApptCost", "apptCost"] as const) {
    if (pooled[key] > 0) values[key] = pooled[key];
  }
  return { values, clients: bench.cplClients };
}

/** A KPI value vs the portfolio's: status for the colour, and how far off in words. Null when not comparable. */
export function kpiVsPortfolio(
  key: KpiKey,
  value: number,
  averages: PortfolioAverages | null,
): { status: CostStatus; text: string } | null {
  const dir = DIRECTION[key];
  const avg = averages?.values[key];
  if (!dir || !avg || value <= 0) return null;
  const status = dir === "lower" ? costStatus(value, avg) : rateStatus(value, avg);
  if (!status) return null;
  const diff = value / avg - 1;
  const pctOff = Math.round(Math.abs(diff) * 100);
  const word = pctOff === 0 ? "at" : diff > 0 ? "above" : "below";
  return { status, text: pctOff === 0 ? "At portfolio avg" : `${pctOff}% ${word} portfolio avg` };
}
