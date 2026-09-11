import { ChevronRight } from "lucide-react";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FunnelStep } from "./funnelMath";

const pct = (r: number) => `${(r * 100).toFixed(r < 0.1 ? 1 : 0)}%`;

/**
 * Impressions → link clicks → page views → leads → appointments, with the
 * conversion between each step. Numbers, not bars: the steps span four orders
 * of magnitude, so bar lengths would hide everything after the click.
 */
export function FunnelSteps({ steps }: { steps: FunnelStep[] }) {
  return (
    <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5" aria-label="Funnel steps">
      {steps.map((s, i) => (
        <li key={s.key} className="relative">
          <div className={cn("h-full rounded-xl border px-3 py-2.5 shadow-sm", s.value === null ? "border-dashed border-border bg-muted/30" : "border-border/50 bg-card")}>
            <p className="h-4 text-[11px] text-muted-foreground">
              {i > 0 && s.rateLabel && (
                <>
                  {s.rateLabel}{" "}
                  <span className="font-semibold tabular-nums text-foreground">{s.rate !== null ? pct(s.rate) : "—"}</span>
                </>
              )}
            </p>
            <p className={cn("mt-1 text-lg font-bold leading-tight tracking-tight tabular-nums", s.value === null ? "text-muted-foreground/60" : "text-foreground")}>
              {s.value !== null ? formatCount(s.value) : "—"}
            </p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
            {s.value === null && <p className="text-[10px] text-muted-foreground/80">Not tracked: no Schedule event</p>}
          </div>
          {i < steps.length - 1 && (
            <ChevronRight
              className="absolute -right-2 top-1/2 z-10 hidden h-4 w-4 -translate-y-1/2 rounded-full bg-background text-muted-foreground sm:block"
              aria-hidden
            />
          )}
        </li>
      ))}
    </ol>
  );
}
