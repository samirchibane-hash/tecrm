import type { CreativeKillReviewRow, KillRule, KillVerdict } from "./types";

/**
 * Yan's turn-off rules, from analyze.py (verified against both runs).
 *
 * a — since-last-lead spend >= $200 (through the day before the run)
 * b — current 14 days have at least one website lead and CPL > $100
 * c — since-last-Schedule spend > $400 (strict; $400.00 does not hit)
 * d — current 14-day spend >= $50 and (CPLC > $5 or there were no link clicks)
 */
export function rulesHit(input: {
  sinceLeadSpend: number;
  curLeads: number;
  curCpl: number | null;
  sinceApptSpend: number;
  curSpend: number;
  curCplc: number | null;
}): KillRule[] {
  const rules: KillRule[] = [];
  if (input.sinceLeadSpend >= 200) rules.push("a");
  if (input.curLeads >= 1 && input.curCpl != null && input.curCpl > 100) rules.push("b");
  if (input.sinceApptSpend > 400) rules.push("c");
  if (input.curSpend >= 50 && (input.curCplc == null || input.curCplc > 5)) rules.push("d");
  return rules;
}

export function rulesHitForRow(row: CreativeKillReviewRow): KillRule[] {
  return rulesHit({
    sinceLeadSpend: row.since_lead_spend,
    curLeads: row.cur_leads,
    curCpl: row.cur_cpl,
    sinceApptSpend: row.since_appt_spend,
    curSpend: row.cur_spend,
    curCplc: row.cplc,
  });
}

export const RULE_COPY: Record<KillRule, { label: string; detail: string }> = {
  a: {
    label: "$200+ since last lead",
    detail: "Spend since the last website-pixel lead is $200 or more, through the day before the run.",
  },
  b: {
    label: "CPL over $100",
    detail: "At least one website-pixel lead in the last 14 days, and cost per lead over $100.",
  },
  c: {
    label: "Over $400 since last Schedule",
    detail: "Spend since the last Meta pixel Schedule is over $400, through the day before the run. Exactly $400 does not hit this rule.",
  },
  d: {
    label: "Early signal · $50+ spent, CPLC over $5",
    detail: "Last 14 days spent $50 or more, and cost per link click is over $5, or there were no link clicks.",
  },
};

export const VERDICT_LABEL: Record<KillVerdict, string> = {
  turn_off: "Turn off",
  watch: "Watch",
  keep: "Keep",
};

/** Treat Engine's own ad account. Never a client kill-review row. */
export const INTERNAL_AD_ACCOUNT = "act_1170300274125472";

const TRUE_H2O = /true\s*h2o/i;
const CLEAR_DEALS = /clear\s*deals/i;
const INTERNAL_WORD = /\binternal\b/i;

/**
 * Account Performance website ads only. Drops the internal ad account,
 * True H2O (cancelled), and ClearDeals or internal campaigns. Instant Forms
 * are out because lead_source must be the website pixel.
 */
export function inKillReviewScope(row: CreativeKillReviewRow): boolean {
  const act = row.act.startsWith("act_") ? row.act : `act_${row.act}`;
  if (act === INTERNAL_AD_ACCOUNT) return false;
  if (row.lead_source !== "website") return false;
  if (TRUE_H2O.test(row.client_name) || TRUE_H2O.test(row.campaign_name ?? "")) return false;
  const named = [row.client_name, row.campaign_name, row.adset_name, row.ad_name];
  if (named.some((value) => value != null && CLEAR_DEALS.test(value))) return false;
  if (INTERNAL_WORD.test(row.client_name) || INTERNAL_WORD.test(row.campaign_name ?? "")) return false;
  return true;
}

/**
 * Ads Manager `act` is the account number only. The act_ prefix is stripped,
 * matching AccountHeader.
 */
export function adsManagerAdUrl(act: string, adId: string): string {
  const accountNumber = act.replace(/^act_/, "");
  const params = new URLSearchParams({ act: accountNumber, selected_ad_ids: adId });
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?${params.toString()}`;
}

export function onlyLiveLabel(value: boolean | null): string {
  if (value === true) return "Only live ad in this ad set";
  if (value === false) return "Other live ads in this ad set";
  return "Only live in ad set: unknown";
}

export type KillSort = "spend" | "cpl";
export type KillVerdictFilter = "all" | KillVerdict | "none";

export function filterKillReviews(
  rows: CreativeKillReviewRow[],
  filter: { client: string; verdict: KillVerdictFilter },
): CreativeKillReviewRow[] {
  return rows.filter((row) => {
    if (filter.client !== "all" && row.client_name !== filter.client) return false;
    if (filter.verdict === "none") return row.verdict == null;
    if (filter.verdict !== "all") return row.verdict === filter.verdict;
    return true;
  });
}

/** Highest spend or CPL first. A missing CPL sorts last. Ties keep n order. */
export function sortKillReviews(rows: CreativeKillReviewRow[], sort: KillSort): CreativeKillReviewRow[] {
  return [...rows].sort((a, b) => {
    if (sort === "spend") return b.cur_spend - a.cur_spend || a.n - b.n;
    if (a.cur_cpl == null && b.cur_cpl == null) return a.n - b.n;
    if (a.cur_cpl == null) return 1;
    if (b.cur_cpl == null) return -1;
    return b.cur_cpl - a.cur_cpl || a.n - b.n;
  });
}

/** Samir's reply to Yan. Numbers stay the run's stable n, ascending. */
export function copyReply(ns: number[]): string {
  const unique = [...new Set(ns)].filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
  if (unique.length === 0) return "";
  return `turn off ${unique.join(", ")}`;
}

export function killReviewTotals(rows: CreativeKillReviewRow[]): {
  flagged: number;
  spendAtRisk: number;
  /** Null when this set has no verdicts. A real zero means verdicts exist and none say turn off. */
  turnOffSpend: number | null;
  turnOffCount: number | null;
} {
  const hasVerdicts = rows.some((row) => row.verdict != null);
  const turnOffs = rows.filter((row) => row.verdict === "turn_off");
  return {
    flagged: rows.length,
    spendAtRisk: rows.reduce((sum, row) => sum + row.cur_spend, 0),
    turnOffSpend: hasVerdicts ? turnOffs.reduce((sum, row) => sum + row.cur_spend, 0) : null,
    turnOffCount: hasVerdicts ? turnOffs.length : null,
  };
}
