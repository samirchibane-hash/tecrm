import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/StatusPill";
import type { KpiChange } from "@/lib/accountKpis";
import { cn } from "@/lib/utils";

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
}) {
  const interactive = !!onClick && !unavailable && !loading;
  const showChange = !loading && !unavailable && !!change;
  const ChangeIcon = change ? CHANGE_ICON[change.direction] : Minus;
  const comfortable = size === "comfortable";

  const body = (
    <CardContent className={cn(comfortable ? "p-3 sm:p-5" : "p-3")}>
      <div className={cn("flex items-center gap-2.5", comfortable && "sm:block")}>
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            comfortable && "sm:h-10 sm:w-10",
            unavailable ? "bg-muted" : isActive ? "bg-primary" : "bg-primary/10",
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4",
              comfortable && "sm:h-5 sm:w-5",
              unavailable
                ? "text-muted-foreground"
                : isActive
                  ? "text-primary-foreground"
                  : "text-primary",
            )}
          />
        </div>
        <div className={cn("min-w-0 text-left", comfortable && "sm:mt-3")}>
          {loading ? (
            <Skeleton
              className={cn("my-0.5 h-5 w-16 bg-foreground/10", comfortable && "sm:h-7 sm:w-24")}
              aria-hidden
            />
          ) : (
            <p
              className={cn(
                "font-bold tracking-tight leading-tight tabular-nums",
                comfortable ? "text-base sm:text-2xl" : "text-base",
                unavailable ? "text-muted-foreground/60" : "text-foreground",
              )}
            >
              {unavailable ? "—" : value}
            </p>
          )}
          <p
            className={cn(
              "font-medium uppercase tracking-wider text-muted-foreground truncate",
              comfortable ? "text-[10px] sm:text-xs" : "text-[10px]",
            )}
          >
            {label}
          </p>
          {loading && <span className="sr-only">Loading</span>}
          {showChange && change && (
            <p
              className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground"
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
            <p className="mt-0.5 truncate text-[11px] font-normal text-muted-foreground/80" title={detail}>
              {detail}
            </p>
          )}
          {unavailable && unavailableReason && (
            <p className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-muted-foreground/80 truncate">
              {unavailableReason}
            </p>
          )}
        </div>
      </div>
    </CardContent>
  );

  const cardClass = cn(
    "shadow-sm transition-all",
    unavailable ? "border-dashed border-border bg-muted/30" : "border-border/50 bg-card",
    interactive && "cursor-pointer hover:shadow-md",
    isActive && !unavailable && "ring-2 ring-primary border-primary/30",
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
        "w-full rounded-lg border text-card-foreground",
        cardClass,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      {body}
    </button>
  );
}
