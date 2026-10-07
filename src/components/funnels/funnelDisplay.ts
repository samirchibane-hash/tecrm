import { CALL_AT, LEAN_AT, MIN_ARM_VIEWS, type FunnelRow, type SplitArm, type SplitTest } from "./funnelRows";

export const pct = (r: number) => `${(r * 100).toFixed(1)}%`;
export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const ATTRIBUTED =
  "GoHighLevel contacts carrying this page's lp_page and an lp_variant, from the ad's UTM parameters";

export type HistoryEvent =
  | { kind: "copy"; at: string; key: string; version: FunnelRow["versions"][number] }
  | { kind: "test"; at: string; key: string; test: FunnelRow["pastTests"][number] };

/** Everything that changed on the page, newest first: copy versions and split tests on one timeline. */
export function historyEvents(row: FunnelRow): HistoryEvent[] {
  const tests = [...(row.runningTest ? [row.runningTest] : []), ...row.pastTests];
  return [
    ...row.versions.map((v): HistoryEvent => ({ kind: "copy", at: v.from, key: `v-${v.version}-${v.variant}`, version: v })),
    ...tests.map((t): HistoryEvent => ({ kind: "test", at: t.startedAt, key: `t-${t.id}`, test: t })),
  ].sort((a, b) => b.at.localeCompare(a.at));
}

export type Pill = "success" | "danger" | "warning" | "info" | "neutral";

export const signed = (r: number) => `${r >= 0 ? "+" : "−"}${Math.abs(r * 100).toFixed(0)}%`;

export const ARM_STATUS: Record<SplitArm["status"], { status: Pill; label: string; help: string }> = {
  winner: { status: "success", label: "Winner", help: `${pct(CALL_AT)}+ chance to convert best, every arm past ${MIN_ARM_VIEWS} views` },
  leading: { status: "info", label: "Leading", help: `${pct(LEAN_AT)}+ chance to convert best: a lean, not a call yet` },
  trailing: { status: "neutral", label: "Trailing", help: "Another arm is more likely to convert best" },
  losing: { status: "danger", label: "Losing", help: `Under ${pct(1 - CALL_AT)} chance to convert best` },
  even: { status: "neutral", label: "Too close", help: "Nothing separates the arms yet" },
  needs_traffic: { status: "neutral", label: "Needs traffic", help: `Under ${MIN_ARM_VIEWS} views on an arm: too few to read` },
  not_tracked: { status: "neutral", label: "Not tracked", help: "No lead on this arm carries an lp_page and lp_variant" },
};

/** What a test says, in one sentence: the headline of its panel and the pill on its row. */
export function verdictLine(test: SplitTest): { title: string; short: string; detail: string; tone: Pill } {
  const leader = test.arms.find((a) => a.variant === test.leader) ?? null;
  if (!leader || test.leaderChance === null) {
    return { title: "Waiting on data", short: "Test: waiting on data", detail: "Needs attributed leads on at least two arms before it can be read.", tone: "neutral" };
  }
  const L = leader.variant.toUpperCase();
  const pctWin = Math.round(test.leaderChance * 100);
  const chance = `${pctWin}% chance ${L} converts best`;
  const vs = test.control && test.control !== leader.variant ? ` vs ${test.control.toUpperCase()}` : "";
  const lift = leader.lift != null ? ` · ${signed(leader.lift)} lead rate${vs}` : "";
  switch (leader.status) {
    case "winner":
      return { title: `${L} wins`, short: `${L} wins · ${pctWin}%`, detail: `${chance}${lift}. Roll it out and queue the next test.`, tone: "success" };
    case "leading":
      return { title: `${L} is leading`, short: `${L} leading · ${pctWin}%`, detail: `${chance}${lift}.`, tone: "info" };
    case "needs_traffic":
      return { title: "Needs traffic", short: "Test: needs traffic", detail: `${chance}${lift}, on too few views to lean on.`, tone: "neutral" };
    default:
      return { title: "Too close to call", short: "Test: too close", detail: `${chance}${lift}.`, tone: "neutral" };
  }
}
