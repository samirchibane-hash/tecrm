import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CostStatus = "success" | "warning" | "danger";

export const TEXT: Record<CostStatus, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

// Shape as well as color, so the three states survive color blindness and print:
// circle = at or under target, square = up to 25% over, triangle = further over.
export const MARK: Record<CostStatus, string> = {
  success: "h-2 w-2 rounded-full bg-success",
  warning: "h-2 w-2 rounded-[2px] bg-warning",
  danger: "h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-danger",
};

/**
 * What a cost is read against: an account's own target, or the portfolio
 * average (the dashboard, where one bar for every active client is the point).
 */
export type CostBasis = "target" | "average";

const NOUN: Record<CostBasis, string> = { target: "target", average: "portfolio average" };

const spoken = (status: CostStatus, basis: CostBasis) =>
  ({
    success: `at or under ${NOUN[basis]}`,
    warning: `up to 25% over ${NOUN[basis]}`,
    danger: `more than 25% over ${NOUN[basis]}`,
  })[status];

/** A cost read against a benchmark. No benchmark, no judgement. */
export function CostVsTarget({
  value,
  target,
  status,
  basis = "target",
  className,
}: {
  value: number;
  target: number | null;
  status: CostStatus | null;
  basis?: CostBasis;
  className?: string;
}) {
  const title = target
    ? `${formatUsd(value)} vs ${formatUsd(target)} ${NOUN[basis]}`
    : basis === "target" ? "No target set for this account" : "Not enough data for a portfolio average";
  return (
    <span className={cn("inline-flex items-center justify-end gap-1.5", className)} title={title}>
      {status && <span aria-hidden className={cn("shrink-0", MARK[status])} />}
      <span className={cn("font-semibold tabular-nums", status ? TEXT[status] : "text-foreground")}>{formatUsd(value)}</span>
      {status && <span className="sr-only">, {spoken(status, basis)}</span>}
    </span>
  );
}

const COST_LEGEND: { status: CostStatus; label: (basis: CostBasis) => string }[] = [
  { status: "success", label: (b) => `At or under ${NOUN[b]}` },
  { status: "warning", label: () => "Up to 25% over" },
  { status: "danger", label: () => "More than 25% over" },
];

export function CostLegend({ basis = "target", className }: { basis?: CostBasis; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {COST_LEGEND.map((l) => (
        <li key={l.status} className="flex items-center gap-1.5">
          <span aria-hidden className={MARK[l.status]} />
          {l.label(basis)}
        </li>
      ))}
    </ul>
  );
}

const pctText = (r: number) => `${(r * 100).toFixed(1)}%`;

/**
 * A rate (higher is better) read against the portfolio average, marked the same
 * way costs are: circle at or above, square within 20% under, triangle further under.
 */
export function RateVsAverage({
  value,
  average,
  status,
  label,
  className,
}: {
  value: number;
  average: number | null;
  status: CostStatus | null;
  /** What the rate is, for the tooltip: "Conversion", "Lead → appt". */
  label: string;
  className?: string;
}) {
  const where = status
    ? { success: "at or above", warning: "up to 20% under", danger: "more than 20% under" }[status]
    : null;
  const title = average
    ? `${label} ${pctText(value)} vs ${pctText(average)} portfolio average`
    : "Not enough data for a portfolio average";
  return (
    <span className={cn("inline-flex items-center justify-end gap-1.5", className)} title={title}>
      {status && <span aria-hidden className={cn("shrink-0", MARK[status])} />}
      <span className={cn("font-semibold tabular-nums", status ? TEXT[status] : "text-foreground")}>{pctText(value)}</span>
      {where && <span className="sr-only">, {where} the portfolio average</span>}
    </span>
  );
}
