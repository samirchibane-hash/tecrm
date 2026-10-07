import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { Dash } from "@/components/creative-performance/CreativeBits";
import { CALL_AT, MIN_ARM_VIEWS, type SplitArm, type SplitTest } from "./funnelRows";
import { ARM_STATUS, ATTRIBUTED, pct, shortDate, signed, verdictLine } from "./funnelDisplay";

/** Dot = lead rate, bar = its 95% range, on one scale shared by every arm in the test. */
function RangePlot({ arm, max, highlight }: { arm: SplitArm; max: number; highlight: boolean }) {
  if (arm.cvr === null || !arm.interval || max <= 0) return <Dash title="No rate yet" />;
  const x = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div
      className="relative h-4 w-full min-w-[72px]"
      title={`${pct(arm.cvr)} of views became leads · 95% range ${pct(arm.interval.low)}–${pct(arm.interval.high)}`}
      role="img"
      aria-label={`Lead rate ${pct(arm.cvr)}, range ${pct(arm.interval.low)} to ${pct(arm.interval.high)}`}
    >
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" aria-hidden />
      <span
        className={cn("absolute top-1/2 h-1 -translate-y-1/2 rounded-full", highlight ? "bg-primary/30" : "bg-muted-foreground/25")}
        style={{ left: x(arm.interval.low), width: `calc(${x(arm.interval.high)} - ${x(arm.interval.low)})` }}
        aria-hidden
      />
      <span
        className={cn(
          "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
          highlight ? "bg-primary" : "bg-muted-foreground",
        )}
        style={{ left: x(arm.cvr) }}
        aria-hidden
      />
    </div>
  );
}

function ChanceBar({ value, highlight }: { value: number | null; highlight: boolean }) {
  if (value === null) return <Dash title="Not measured" />;
  return (
    <div className="flex items-center gap-2" title={`${pct(value)} chance this arm has the best lead rate`}>
      <div className="h-1.5 w-full min-w-[40px] overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className={cn("h-full rounded-full", highlight ? "bg-primary" : "bg-muted-foreground/50")} style={{ width: `${value * 100}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">{Math.round(value * 100)}%</span>
    </div>
  );
}

/**
 * A split test, read the way experimentation tools read one: which arm is most
 * likely best and how sure we are, the lift over control, and how long until
 * it can be called at the traffic it gets now.
 *
 * Views come from the page's own beacon (only the page knows which arm a
 * visitor saw). Leads and appts are the attributed GoHighLevel contacts the
 * row above counts — one definition of a lead on the screen.
 *
 * `compact` drops the summary and footer, for the history timeline.
 */
export function SplitTestPanel({ test, compact = false }: { test: SplitTest; compact?: boolean }) {
  const line = verdictLine(test);
  const max = Math.max(0, ...test.arms.map((a) => a.interval?.high ?? 0)) * 1.1;
  const lead = test.leader;

  return (
    <section className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border/60 px-3 py-2">
        <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <h4 className="min-w-0 truncate text-xs font-semibold text-foreground" title={test.name ?? undefined}>
          {test.name ?? "Split test"}
        </h4>
        <StatusPill status={test.running ? "info" : "neutral"}>{test.running ? "Running" : "Stopped"}</StatusPill>
        <span className="text-[11px] text-muted-foreground">
          {shortDate(test.startedAt)}
          {test.stoppedAt ? ` – ${shortDate(test.stoppedAt)}` : " – now"} · day {test.daysRunning + 1}
        </span>
        {test.winnerVariant && <StatusPill status="success">Called: {test.winnerVariant.toUpperCase()}</StatusPill>}
      </header>

      {!compact && (
        <div className="grid gap-3 border-b border-border/60 bg-muted/30 px-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-foreground">
              {line.title}
              {lead && test.leaderChance !== null && (
                <StatusPill status={line.tone}>{Math.round(test.leaderChance * 100)}% to win</StatusPill>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{line.detail}</p>
          </div>
          {test.callIn && (
            <div className="text-xs sm:text-right">
              {test.callIn.notWorthWaiting ? (
                <p className="max-w-[260px] text-muted-foreground">
                  <span className="font-medium text-foreground">Gap too small to wait for.</span> Over{" "}
                  {formatCount(test.callIn.viewsPerArm)} more views an arm. Call it even and test something bolder.
                </p>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground">To call it</p>
                  <p className="font-semibold tabular-nums text-foreground">
                    {formatCount(test.callIn.viewsPerArm)} more views an arm
                  </p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {test.callIn.days !== null
                      ? `≈ ${test.callIn.days} ${test.callIn.days === 1 ? "day" : "days"} at this week's traffic`
                      : "No traffic this week"}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {test.arms.length === 0 ? (
        <p className="px-3 py-3 text-[11px] text-muted-foreground">No arm has reported a view yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-3 py-1.5 text-left font-medium">Arm</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Views</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Leads</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Conv. · 95% range</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Appts</th>
                <th scope="col" className="px-2 py-1.5 text-right font-medium">Lead → appt</th>
                <th scope="col" className="px-2 py-1.5 text-left font-medium">Chance to win</th>
                <th scope="col" className="px-3 py-1.5 text-right font-medium"><span className="sr-only">Status</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {test.arms.map((arm) => {
                const s = ARM_STATUS[arm.status];
                const hi = arm.variant === lead && (arm.status === "winner" || arm.status === "leading");
                return (
                  <tr key={arm.variant} className={cn(hi && "bg-primary/5")}>
                    <td className="max-w-[240px] px-3 py-2">
                      <div className="flex items-start gap-2">
                        <span className="mt-px shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                          {arm.variant.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[11px] text-foreground/90" title={arm.headline ?? undefined}>
                            {arm.headline ? `“${arm.headline}”` : "Copy not recorded"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {arm.variant === test.control ? "Control" : arm.lift != null ? `${signed(arm.lift)} vs control` : " "}
                            {arm.weight !== null && ` · ${arm.weight}% traffic`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-foreground">{formatCount(arm.views)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-foreground" title={arm.leads === null ? undefined : ATTRIBUTED}>
                      {arm.leads === null
                        ? <Dash title="No lead on this arm carries an lp_page and lp_variant: unknown, not zero" />
                        : formatCount(arm.leads)}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-foreground">
                          {arm.cvr === null ? <Dash title="No rate yet" /> : pct(arm.cvr)}
                        </span>
                        <RangePlot arm={arm} max={max} highlight={hi} />
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-foreground">
                      {arm.booked === null ? <Dash title="No booking data for this arm yet" /> : formatCount(arm.booked)}
                    </td>
                    <td
                      className="px-2 py-2 text-right tabular-nums text-foreground"
                      title={arm.apptChanceBest !== null ? `${pct(arm.apptChanceBest)} chance this arm books best per view` : undefined}
                    >
                      {arm.bookedRate === null ? <Dash title="No leads to book yet" /> : pct(arm.bookedRate)}
                    </td>
                    <td className="w-[120px] px-2 py-2">
                      <ChanceBar value={arm.chanceBest} highlight={hi} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span title={s.help}><StatusPill status={s.status}>{s.label}</StatusPill></span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!compact && (
        <p className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
          A winner needs a {pct(CALL_AT)} chance to convert best, {MIN_ARM_VIEWS}+ views on every arm and 3+ leads.
          Views come from the page; leads and appts are the attributed GoHighLevel contacts the row counts.
        </p>
      )}
    </section>
  );
}
