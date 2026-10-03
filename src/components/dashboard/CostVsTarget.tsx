import { formatUsd } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CostStatus = "success" | "warning" | "danger";

const TEXT: Record<CostStatus, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

// Shape as well as color, so the three states survive color blindness and print:
// circle = at or under target, square = up to 25% over, triangle = further over.
const MARK: Record<CostStatus, string> = {
  success: "h-2 w-2 rounded-full bg-success",
  warning: "h-2 w-2 rounded-[2px] bg-warning",
  danger: "h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-danger",
};

const SPOKEN: Record<CostStatus, string> = {
  success: "at or under target",
  warning: "up to 25% over target",
  danger: "more than 25% over target",
};

/** A cost read against the account's own target. No target, no judgement. */
export function CostVsTarget({
  value,
  target,
  status,
  className,
}: {
  value: number;
  target: number | null;
  status: CostStatus | null;
  className?: string;
}) {
  const title = target ? `${formatUsd(value)} vs ${formatUsd(target)} target` : "No target set for this account";
  return (
    <span className={cn("inline-flex items-center justify-end gap-1.5", className)} title={title}>
      {status && <span aria-hidden className={cn("shrink-0", MARK[status])} />}
      <span className={cn("font-semibold tabular-nums", status ? TEXT[status] : "text-foreground")}>{formatUsd(value)}</span>
      {status && <span className="sr-only">, {SPOKEN[status]}</span>}
    </span>
  );
}

const COST_LEGEND: { status: CostStatus; label: string }[] = [
  { status: "success", label: "At or under target" },
  { status: "warning", label: "Up to 25% over" },
  { status: "danger", label: "More than 25% over" },
];

export function CostLegend({ className }: { className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground", className)}>
      {COST_LEGEND.map((l) => (
        <li key={l.status} className="flex items-center gap-1.5">
          <span aria-hidden className={MARK[l.status]} />
          {l.label}
        </li>
      ))}
    </ul>
  );
}
