// Its own module so the control and the gallery can share it without a
// component file exporting non-components (fast refresh).

// "More than / Fewer than X" on a per-ad count (leads, appointments). Strict
// comparisons, matching the labels.
export type CountOp = "any" | "gt" | "lt";
export interface CountFilterValue {
  op: CountOp;
  count: string;
}
export const NO_COUNT_FILTER: CountFilterValue = { op: "any", count: "" };

export const OP_LABEL: Record<Exclude<CountOp, "any">, string> = { gt: "More than", lt: "Fewer than" };

/** The threshold in force, or null when the filter is off. Blank or invalid input leaves the list unfiltered. */
export function countThreshold({ op, count }: CountFilterValue): number | null {
  if (op === "any" || count.trim() === "" || !Number.isFinite(Number(count))) return null;
  return Math.max(0, Number(count));
}

/** Whether a count passes. A null count (unknown, e.g. not tracked) never passes an active filter. */
export function passesCount(value: number | null, f: CountFilterValue): boolean {
  const t = countThreshold(f);
  if (t === null) return true;
  if (value === null) return false;
  return f.op === "gt" ? value > t : value < t;
}

/** "fewer than 3 appts", for empty states. */
export function describeCount(f: CountFilterValue, noun: string): string | null {
  const t = countThreshold(f);
  return t === null || f.op === "any" ? null : `${OP_LABEL[f.op].toLowerCase()} ${t} ${noun}`;
}
