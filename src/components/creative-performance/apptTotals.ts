// The gallery's Appts tile: Meta Schedule events across the listed ads or copy
// rows. Accounts that don't track appointments report null, which is unknown,
// not zero, so those rows (and their spend) stay out of the count and the cost.

export interface ApptTotals {
  /** Rows whose account tracks appointments. 0 = nothing listed tracks them. */
  tracked: number;
  /** Rows that don't, left out of both figures. */
  untracked: number;
  appointments: number;
  /** Spend ÷ appointments over the tracked rows only; null when there were none, never $0. */
  costPerAppt: number | null;
}

export function apptTotals(rows: { spend: number; appointments: number | null }[]): ApptTotals {
  let tracked = 0, untracked = 0, appointments = 0, spend = 0;
  for (const r of rows) {
    if (r.appointments === null) {
      untracked++;
      continue;
    }
    tracked++;
    appointments += r.appointments;
    spend += r.spend;
  }
  return { tracked, untracked, appointments, costPerAppt: appointments > 0 ? spend / appointments : null };
}
