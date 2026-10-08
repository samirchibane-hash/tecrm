import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/StatusPill";
import type { KpiChange } from "@/lib/accountKpis";
import { cn } from "@/lib/utils";
import { MARK, TEXT, type CostStatus } from "./costMarks";

const CHANGE_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus } as const;

/**
 * The one KPI tile. Previously forked inline in ClientReport and AccountDetail;
 * both now render this so the loading / unavailable states stay identical.
 *
 * `unavailable` is a first-class state, not a styling flag: when a feed is down
 * the tile must read "—" with a reason, never a misleading 0 (design rule #5).
 * `loading` is the same idea for a query still in flight: a skeleton, never a 0.
 *
 * `change` is the period-over-period pill. Pass `null` (or omit it) whenever no
 * honest comparison exists; the tile then simply doesn't claim one.
 */
export function KpiStatCard({
  label,
  value,
  icon: Icon,
  isActive,
  onClick,
  unavailable = false,
  unavailableReason,
  detail,
  loading = false,
  change,
  changeLabel,
  changeTitle,
  size = "compact",
  benchmark,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  isActive?: boolean;
  onClick?: () => void;
  unavailable?: boolean;
  unavailableReason?: string;
  /** One quiet line of context under the label, e.g. "12 active · 7 paused". */
  detail?: string;
  loading?: boolean;
  change?: KpiChange | null;
  /** What the change is against, e.g. "vs prior 30 days". */
  changeLabel?: string;
  /** The prior period's exact dates, for the tooltip. */
  changeTitle?: string;
  size?: "compact" | "comfortable";
  /** The value read against a shared bar (the portfolio average): colours the number, says how far off. */
  benchmark?: { status: CostStatus; text: string; title?: string } | null;
}) {
  const interactive = !!onClick && !unavailable && !loading;
  const showChange = !loading && !unavailable && !!change;
  const ChangeIcon = change ? CHANGE_ICON[change.direction] : Minus;
  const comfortable = size === "comfortable";

  // Label first, then the number, then what it is measured against — the order
  // a reader asks the questions in. The icon is a quiet marker, not a badge.
  const body = (
    <CardContent className={cn("flex h-full flex-col gap-1 text-left", comfortable ? "p-4 sm:p-5" : "p-3.5")}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("min-w-0 truncate font-medium text-foreground", comfortable ? "text-[13px] sm:text-sm" : "text-[13px]")}>
          {label}
        </p>
        <Icon
          aria-hidden
          className={cn("h-4 w-4 shrink-0", isActive && !unavailable ? "text-primary" : "text-muted-foreground/70")}
        />
      </div>
      {loading ? (
        <Skeleton
          className={cn("my-1 h-6 w-20 bg-foreground/10", comfortable && "sm:h-8 sm:w-28")}
          aria-hidden
        />
      ) : (
        <p
          className={cn(
            "font-semibold leading-tight tracking-tight tabular-nums",
            comfortable ? "text-xl sm:text-[28px] sm:leading-9" : "text-xl",
            unavailable ? "text-muted-foreground" : benchmark ? TEXT[benchmark.status] : "text-foreground",
          )}
        >
          {unavailable ? "—" : value}
        </p>
      )}
      {!loading && !unavailable && benchmark && (
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground" title={benchmark.title ?? benchmark.text}>
          <span aria-hidden className={cn("shrink-0", MARK[benchmark.status])} />
          <span className="truncate">{benchmark.text}</span>
        </p>
      )}
      {loading && <span className="sr-only">Loading</span>}
      {showChange && change && (
        <p
          className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground"
          title={changeTitle ? `${change.spoken} vs ${changeTitle}` : change.spoken}
        >
          <StatusPill status={change.tone} className="gap-0.5 px-1.5 tabular-nums">
            <ChangeIcon className="h-3 w-3" aria-hidden />
            <span aria-hidden>{change.text}</span>
            <span className="sr-only">{change.spoken}</span>
          </StatusPill>
          {changeLabel && <span className="whitespace-nowrap">{changeLabel}</span>}
        </p>
      )}
      {!unavailable && !loading && detail && (
        <p className="mt-auto truncate pt-0.5 text-xs text-muted-foreground" title={detail}>
          {detail}
        </p>
      )}
      {unavailable && unavailableReason && (
        <p className="truncate text-xs text-muted-foreground">{unavailableReason}</p>
      )}
    </CardContent>
  );

  const cardClass = cn(
    "rounded-xl transition-shadow",
    unavailable ? "border-dashed border-border bg-muted/40 shadow-none" : "border-border/70 bg-card shadow-sm",
    interactive && "cursor-pointer hover:shadow-md",
    isActive && !unavailable && "border-primary/40 ring-2 ring-primary",
  );

  if (!interactive) {
    return (
      <Card
        className={cardClass}
        aria-disabled={unavailable || undefined}
        aria-busy={loading || undefined}
        title={unavailable ? unavailableReason : undefined}
      >
        {body}
      </Card>
    );
  }

  // Clickable tiles drive the chart selection, so they need a real keyboard path
  // (design rule #8) — a <button> carrying the same Card surface classes.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        "w-full border text-card-foreground",
        cardClass,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      {body}
    </button>
  );
}
