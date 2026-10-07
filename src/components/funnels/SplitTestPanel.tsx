import { FlaskConical } from "lucide-react";
import { formatCount } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { Dash } from "@/components/creative-performance/CreativeBits";
import { MIN_ARM_VIEWS, type SplitArm, type SplitTest } from "./funnelRows";
import { ATTRIBUTED, pct, shortDate } from "./funnelDisplay";

const ARM_STATUS: Record<SplitArm["status"], { status: "success" | "danger" | "neutral"; label: string; help: string }> = {
  leader: { status: "success", label: "Ahead", help: "Converting best of the arms with enough traffic to compare" },
  behind: { status: "danger", label: "Behind", help: "Converting worse than the leading arm, at 95% confidence" },
  even: { status: "neutral", label: "Too close to call", help: "Not separated from the leading arm yet" },
  needs_traffic: { status: "neutral", label: "Needs traffic", help: `Under ${MIN_ARM_VIEWS} views on this arm: too few to read` },
};

/**
 * A split test, arm by arm.
 *
 * Views come from the page's own beacon because Meta attributes a view to the
 * ad that sent it, not to the arm the visitor was shown, so it cannot split a
 * test. Leads are the attributed GoHighLevel contacts the rest of this screen
 * counts — one definition of a lead on the page, top to bottom.
 *
 * `compact` drops the explanatory footer, for the history timeline where many
 * tests stack.
 */
export function SplitTestPanel({ test, compact = false }: { test: SplitTest; compact?: boolean }) {
  return (
    <section className="rounded-lg border border-border/60 bg-card p-3">
      <header className="mb-2 flex flex-wrap items-center gap-2">
        <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <h4 className="text-xs font-semibold text-foreground">{test.name ?? "Split test"}</h4>
        <StatusPill status={test.running ? "info" : "neutral"}>{test.running ? "Running" : "Stopped"}</StatusPill>
        <span className="text-[11px] text-muted-foreground">
          {shortDate(test.startedAt)}
          {test.stoppedAt ? ` – ${shortDate(test.stoppedAt)}` : " – now"}
        </span>
        {test.winnerVariant && (
          <StatusPill status="success">Winner: {test.winnerVariant.toUpperCase()}</StatusPill>
        )}
      </header>

      {test.arms.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No arm has reported a view yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {test.arms.map((arm) => {
            const s = ARM_STATUS[arm.status];
            return (
              <li key={arm.variant} className="flex items-start gap-2">
                <span className="mt-px shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-foreground">
                  {arm.variant.toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] text-foreground/90" title={arm.headline ?? undefined}>
                    {arm.headline ? `“${arm.headline}”` : "Copy not recorded for this arm"}
                  </p>
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {formatCount(arm.views)} views ·{" "}
                    {arm.leads === null ? (
                      <span title="No lead on this arm carries both an lp_page and an lp_variant, so its count is unknown rather than zero">
                        leads not tracked
                      </span>
                    ) : (
                      <span title={ATTRIBUTED}>
                        {formatCount(arm.leads)} {arm.leads === 1 ? "lead" : "leads"}
                      </span>
                    )}
                    {/* Never render an unattributed arm as "0 appts": no lp_variant on
                        the lead means unknown, and a zero here would read as a page
                        that books nobody. */}
                    {arm.booked === null ? (
                      <span title="No booking data for this arm — its leads carry no lp_variant yet">
                        {" "}· appts not tracked
                      </span>
                    ) : (
                      <span
                        title={
                          arm.bookedRate === null
                            ? "Water tests booked in GoHighLevel"
                            : `${pct(arm.bookedRate)} of this arm's leads booked a water test`
                        }
                      >
                        {" "}· {formatCount(arm.booked)} {arm.booked === 1 ? "appt" : "appts"}
                        {arm.bookedRate !== null && <> ({pct(arm.bookedRate)})</>}
                      </span>
                    )}
                    {arm.weight !== null && <> · {arm.weight}% of traffic</>}
                  </p>
                </div>
                <span title={s.help} className="shrink-0">
                  <StatusPill status={s.status}>{s.label}</StatusPill>
                </span>
                <span
                  className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground"
                  title={
                    arm.cvr === null || !arm.interval
                      ? "Not enough views for a rate"
                      : `${pct(arm.cvr)} of views became leads, 95% range ${pct(arm.interval.low)}–${pct(arm.interval.high)}`
                  }
                >
                  {arm.cvr === null ? <Dash title="No rate yet" /> : pct(arm.cvr)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {!compact && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {test.decided
            ? "An arm is ahead at 95% confidence — safe to call and roll out."
            : "No arm has separated yet."}{" "}
          Views come from the page, which is the only thing that knows which arm a visitor saw.
          Leads and appts count the same attributed GoHighLevel contacts as the row above.
        </p>
      )}
    </section>
  );
}
