import { AHEAD_AT, CALL_AT, LEAN_AT, MIN_ARM_VIEWS, type FunnelRow, type SplitArm, type SplitTest } from "./funnelRows";

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
  leading: { status: "info", label: "Ahead", help: `More likely than not to convert best (${pct(AHEAD_AT)}+): a lean, not a call yet` },
  trailing: { status: "neutral", label: "Trailing", help: "Another arm is more likely to convert best" },
  losing: { status: "danger", label: "Losing", help: `Under ${pct(1 - CALL_AT)} chance to convert best` },
  even: { status: "neutral", label: "Too close", help: "Nothing separates the arms yet" },
  needs_traffic: { status: "neutral", label: "Needs traffic", help: `Under ${MIN_ARM_VIEWS} views on an arm: too few to read` },
  not_tracked: { status: "neutral", label: "Not tracked", help: "No lead on this arm carries an lp_page and lp_variant" },
};

/**
 * What a test says, in one sentence: the headline of its panel and, when there
 * is something to act on (`signal`), the pill on its row. A young test with no
 * lean gets no pill: every test starts out needing traffic.
 */
export function verdictLine(test: SplitTest): { title: string; short: string; detail: string; tone: Pill; signal: boolean } {
  const leader = test.arms.find((a) => a.variant === test.leader) ?? null;
  const done = test.callIn?.done ?? false;
  if (!leader || test.leaderChance === null) {
    return { title: "No leader yet", short: "", detail: "Reads once two arms have attributed leads.", tone: "neutral", signal: false };
  }
  const L = leader.variant.toUpperCase();
  const pctWin = Math.round(test.leaderChance * 100);
  const chance = `${pctWin}% chance ${L} converts best`;
  const vs = test.control && test.control !== leader.variant ? ` vs ${test.control.toUpperCase()}` : "";
  const lift = leader.lift != null ? ` · ${signed(leader.lift)} lead rate${vs}` : "";
  const appts = leader.apptChanceBest != null ? ` · ${Math.round(leader.apptChanceBest * 100)}% chance it books best` : "";
  if (leader.status === "winner") {
    return { title: `${L} wins`, short: `${L} wins · ${pctWin}%`, detail: `${chance}${lift}${appts}. Roll it out and queue the next test.`, tone: "success", signal: true };
  }
  if (done) {
    return {
      title: "Done: no big winner",
      short: "Test done · no big winner",
      detail: `${chance}${lift}${appts}. Neither arm doubled the other: keep ${L} and test something bolder.`,
      tone: "warning",
      signal: true,
    };
  }
  if (leader.status === "leading") {
    return {
      title: `${L} is ahead`,
      short: `${L} ahead · ${pctWin}%`,
      detail: `${chance}${lift}${appts}. Not a call yet: a winner needs ${pct(CALL_AT)}.`,
      tone: test.leaderChance >= LEAN_AT ? "info" : "neutral",
      signal: true,
    };
  }
  return { title: "Dead even so far", short: "", detail: `${chance}${lift}${appts}.`, tone: "neutral", signal: false };
}
