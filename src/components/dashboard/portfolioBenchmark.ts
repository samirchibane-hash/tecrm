import type { CostStatus } from "./CostVsTarget";

/** One client's period on the dashboard: what it spent and what GHL recorded. */
export interface ClientCosts {
  spend: number;
  /** null = spend unknown (Meta can't read the account), never treated as $0. */
  spendKnown: boolean;
  leads: number;
  appointments: number;
}

export interface PortfolioBenchmark {
  /** Cost per GHL lead across active clients; null when no client qualifies. */
  cpl: number | null;
  /** Cost per GHL appointment across active clients; null when no client qualifies. */
  cpa: number | null;
  /** How many clients each average pools. */
  cplClients: number;
  cpaClients: number;
}

/**
 * The bar every client on the dashboard is read against: total spend ÷ total
 * results across the active clients, so a client with 60 leads weighs sixty
 * times one with a single lead — an average of each client's CPL would let one
 * $400 lead move the bar as much as a whole month of volume.
 *
 * A client joins an average only when it spent in the period, its spend is
 * known, and GHL recorded at least one of that result. Spend with zero GHL
 * results is far more often an unmapped sub-account than a real zero, and
 * pooling it would inflate everyone's bar with money no lead was counted for.
 */
export function portfolioBenchmark(clients: ClientCosts[]): PortfolioBenchmark {
  const pool = (count: (c: ClientCosts) => number) => {
    const active = clients.filter((c) => c.spendKnown && c.spend > 0 && count(c) > 0);
    const spend = active.reduce((s, c) => s + c.spend, 0);
    const results = active.reduce((s, c) => s + count(c), 0);
    return { value: results > 0 ? spend / results : null, clients: active.length };
  };
  const cpl = pool((c) => c.leads);
  const cpa = pool((c) => c.appointments);
  return { cpl: cpl.value, cpa: cpa.value, cplClients: cpl.clients, cpaClients: cpa.clients };
}

/** At or under the bar, up to 25% over, or further over. No bar, no judgement. */
export function costStatus(value: number, benchmark: number | null): CostStatus | null {
  if (value <= 0 || !benchmark) return null;
  if (value <= benchmark) return "success";
  if (value <= benchmark * 1.25) return "warning";
  return "danger";
}

/**
 * A rate where higher is better (conversion, lead → appt) read against the
 * portfolio average: the mirror of `costStatus`. At or above the bar, within
 * 20% under it (1 ÷ 1.25, the same band costs get), or further under.
 */
export function rateStatus(value: number | null, average: number | null): CostStatus | null {
  if (value === null || average === null || average <= 0) return null;
  if (value >= average) return "success";
  if (value >= average * 0.8) return "warning";
  return "danger";
}
