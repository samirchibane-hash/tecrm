// Row shape for public.creative_kill_reviews. The preview fixture and the
// (unapplied) migration use the same columns. `id` and `created_at` are
// database defaults and are not part of a published run.

export const KILL_RULES = ["a", "b", "c", "d"] as const;
export type KillRule = (typeof KILL_RULES)[number];

export const KILL_VERDICTS = ["turn_off", "watch", "keep"] as const;
export type KillVerdict = (typeof KILL_VERDICTS)[number];

export type KillLeadSource = "website";

/** Columns Yan publishes, in migration order, excluding id / created_at. */
export const KILL_REVIEW_COLUMNS = [
  "run_date",
  "n",
  "account_id",
  "client_name",
  "act",
  "ad_id",
  "ad_name",
  "adset_id",
  "adset_name",
  "campaign_name",
  "lead_source",
  "thumbnail_url",
  "cur_since",
  "cur_until",
  "prev_since",
  "prev_until",
  "cur_spend",
  "cur_leads",
  "cur_cpl",
  "cur_appts",
  "cplc",
  "ctr",
  "prev_spend",
  "prev_leads",
  "prev_cpl",
  "prev_appts",
  "since_lead_spend",
  "last_lead_on",
  "since_appt_spend",
  "last_appt_on",
  "lifetime_spend",
  "lifetime_leads",
  "rules_hit",
  "only_live_in_adset",
  "verdict",
  "reason",
  "reviewer",
] as const;

export type CreativeKillReviewRow = {
  run_date: string;
  /** Stable number within the run. Sorting and filtering do not renumber it. */
  n: number;
  account_id: string | null;
  client_name: string;
  /** Meta ad account id, with the act_ prefix when Yan sends it that way. */
  act: string;
  ad_id: string;
  ad_name: string;
  adset_id: string;
  adset_name: string;
  /** Not in the current runs. Kept so a ClearDeals or internal campaign can be excluded. */
  campaign_name: string | null;
  /** Website pixel only. Instant Forms never belong in this review. */
  lead_source: KillLeadSource;
  /**
   * Preview rows point at a static asset. Live rows should store the object
   * path inside the private creative-kill-thumbs bucket.
   */
  thumbnail_url: string | null;
  /** Current 14 days, ending the day before the run. */
  cur_since: string;
  cur_until: string;
  prev_since: string;
  prev_until: string;
  cur_spend: number;
  cur_leads: number;
  cur_cpl: number | null;
  /** Meta pixel Schedule events, not GoHighLevel appointments. */
  cur_appts: number;
  /** Cost per link click over the current 14 days. Null when there were no link clicks. */
  cplc: number | null;
  /** Link CTR (inline link clicks ÷ impressions), in percent units. */
  ctr: number | null;
  prev_spend: number;
  prev_leads: number;
  prev_cpl: number | null;
  prev_appts: number;
  /** Spend after the last website-pixel lead, through the day before the run. */
  since_lead_spend: number;
  last_lead_on: string | null;
  /** Spend after the last Meta pixel Schedule, through the day before the run. */
  since_appt_spend: number;
  last_appt_on: string | null;
  lifetime_spend: number;
  lifetime_leads: number;
  rules_hit: KillRule[];
  /** Null means Yan didn't know, not "no". */
  only_live_in_adset: boolean | null;
  /** Null means this run has no call yet. */
  verdict: KillVerdict | null;
  reason: string | null;
  reviewer: string | null;
};

export type KillReviewAccount = {
  id: string;
  account_name: string;
  fb_ad_account_id: string | null;
};
