import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The one KPI tile. Previously forked inline in ClientReport and AccountDetail;
 * both now render this so the loading / unavailable states stay identical.
 *
 * `unavailable` is a first-class state, not a styling flag: when a feed is down
 * the tile must read "—" with a reason, never a misleading 0 (design rule #5).
 */
export function KpiStatCard({
  label,
  value,
  icon: Icon,
  isActive,
  onClick,
  unavailable = false,
  unavailableReason,
  size = "compact",
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  isActive?: boolean;
  onClick?: () => void;
  unavailable?: boolean;
  unavailableReason?: string;
  size?: "compact" | "comfortable";
}) {
  const interactive = !!onClick && !unavailable;
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
          <p
            className={cn(
              "font-bold tracking-tight leading-tight",
              comfortable ? "text-base sm:text-2xl" : "text-base",
              unavailable ? "text-muted-foreground/60" : "text-foreground",
            )}
          >
            {unavailable ? "—" : value}
          </p>
          <p
            className={cn(
              "font-medium uppercase tracking-wider text-muted-foreground truncate",
              comfortable ? "text-[10px] sm:text-xs" : "text-[10px]",
            )}
          >
            {label}
          </p>
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
