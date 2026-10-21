import { differenceInCalendarDays, format, startOfDay, subDays } from "date-fns";
import type { DateRange } from "react-day-picker";
import { ALL_KPIS, type KpiKey, type KpiSource } from "@/components/dashboard/AccountCard";
import type { AdRow } from "@/hooks/useCouplerData";
import type { Status } from "@/components/StatusPill";

/**
 * The account KPI math, once. The account page and the client report both
 * compute their tiles here so a number can't differ between the screen we read
 * and the screen the client reads.
 */

/** The GHL conversion fields the KPIs read. */
export type GhlKpiRow = {
  type: string | null;
  created_on: string;
  appointment_status?: string | null;
  /** The day the appointment is for (a `date` column, yyyy-MM-dd). */
  appointment_time?: string | null;
  deal_value?: number | null;
};

/** coupler-proxy reads Meta for a fixed trailing window (`since` = today − 90d). */
export const META_WINDOW_DAYS = 90;

/** Below this many events in either period, a change is movement, not a signal. */
export const MIN_EVENTS_FOR_SIGNAL = 10;

export const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function inRange(day: Date, range: DateRange | undefined): boolean {
  if (!range?.from) return true;
  const from = startOfDay(range.from);
  const to = startOfDay(range.to ?? range.from);
  return day >= from && day <= to;
}

export function adRowsInRange(rows: readonly AdRow[], range: DateRange | undefined): AdRow[] {
  return rows.filter((r) => inRange(parseDay(r["Report: Date"]), range));
}

export function ghlRowsInRange<T extends GhlKpiRow>(rows: readonly T[], range: DateRange | undefined): T[] {
  return rows.filter((c) => !!c.created_on && inRange(parseDay(c.created_on), range));
}

const isLead = (c: GhlKpiRow) => {
  const t = c.type?.toLowerCase().trim();
  return t === "lead" || t === "water test";
};
/** A booked contact: any appointment row, cancelled or not (the report's list shows both). */
export const isBooked = (c: GhlKpiRow) => {
  const t = c.type?.toLowerCase().trim();
  return t === "appointment" || t === "water test";
};
/** A booking that counts: cancelled ones still list (with their pill) but aren't appointments. */
const isAppt = (c: GhlKpiRow) => isBooked(c) && c.appointment_status !== "cancelled";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The day the appointment is for, as yyyy-MM-dd, read from `appointment_time`.
 * The column is a Postgres `date` today (yyyy-MM-dd); the other formats are read
 * defensively in case n8n starts sending GHL's start time as text. Null when the
 * field holds no date, so the caller falls back to `created_on`.
 * The date is read as written (the calendar's local day), never shifted via UTC.
 */
export function appointmentDay(c: Pick<GhlKpiRow, "appointment_time">): string | null {
  const t = c.appointment_time?.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = t.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (us) return `${us[3]}-${pad(+us[1])}-${pad(+us[2])}`;
  const named = t.match(/\b([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i);
  const month = named ? MONTHS.indexOf(named[1].toLowerCase()) : -1;
  if (named && month >= 0) return `${named[3]}-${pad(month + 1)}-${pad(+named[2])}`;
  return null;
}

/** How far before a period a booking for a day inside it can have come in. Period queries filtered on created_on reach back this far. */
export const BOOKING_LOOKBACK_DAYS = 60;

/** The day a booking belongs to on every screen: its appointment date, else the day the row came in. */
export const bookingDay = (c: GhlKpiRow) => appointmentDay(c) ?? c.created_on;

/**
 * Bookings in a period by the day the appointment is for, so the count matches
 * the client's GHL calendar. A contact who opts in on Oct 30 for a Nov 3 test is
 * a November appointment. Cancelled bookings are included (see `isAppt`).
 */
export function ghlBookingsInRange<T extends GhlKpiRow>(rows: readonly T[], range: DateRange | undefined): T[] {
  return rows.filter((c) => {
    if (!isBooked(c)) return false;
    const day = bookingDay(c);
    return !!day && inRange(parseDay(day), range);
  });
}

/**
 * Every account KPI for one period. Ratios are weighted the way Ads Manager
 * reports them (CTR = clicks ÷ impressions, not the mean of each row's CTR), so
 * a $2 day can't pull the period's CPC as hard as a $200 day.
 */
export function computeAccountKpis(
  adRows: readonly AdRow[],
  ghl: readonly GhlKpiRow[],
  /** The period's bookings (`ghlBookingsInRange`). Omitted = the bookings among `ghl`. */
  bookings: readonly GhlKpiRow[] = ghl,
): Record<KpiKey, number> {
  const sum = (f: (r: AdRow) => number | null | undefined) => adRows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const totalSpend = sum((r) => r["Cost: Amount spend"]);
  const totalClicks = sum((r) => r["Performance: Clicks"]);
  const totalImpressions = sum((r) => r["Performance: Impressions"]);
  const webApptTotal = sum((r) => r["Conversions: Website Appointments Scheduled - Total"]);
  // "- Cost" is each event's cost base (see coupler-proxy): Σ cost ÷ Σ total.
  const webApptCostBase = sum((r) => r["Conversions: Website Appointments Scheduled - Cost"]);
  const apptTotal = sum((r) => r["Conversions: Appointments Scheduled - Total"]);
  const apptCostBase = sum((r) => r["Conversions: Appointments Scheduled - Cost"]);
  // The lead count is GoHighLevel contacts, never Meta's pixel lead (GHL's CAPI
  // re-fires on contact updates, so Meta runs ~2x truth).
  const ghlLeads = ghl.filter(isLead).length;
  const ghlAppointments = bookings.filter(isAppt).length;
  const sold = ghl.filter((c) => c.appointment_status === "sold");
  const totalRevenue = sold.reduce((s, c) => s + (c.deal_value ?? 0), 0);
  return {
    totalSpend,
    totalClicks,
    totalImpressions,
    totalReach: sum((r) => r["Performance: Reach"]),
    avgCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    avgCPC: totalClicks > 0 ? totalSpend / totalClicks : 0,
    avgCPM: totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
    webApptTotal,
    webApptCost: webApptTotal > 0 ? webApptCostBase / webApptTotal : 0,
    apptTotal,
    apptCost: apptTotal > 0 ? apptCostBase / apptTotal : 0,
    ghlLeads,
    ghlAppointments,
    ghlCostPerLead: ghlLeads > 0 ? totalSpend / ghlLeads : 0,
    ghlCostPerAppt: ghlAppointments > 0 ? totalSpend / ghlAppointments : 0,
    soldCount: sold.length,
    totalRevenue,
    adRoi: totalSpend > 0 ? totalRevenue / totalSpend : 0,
  };
}

export type KpiSeries = Partial<Record<KpiKey, { date: string; value: number }[]>>;

/** One daily series per chartable KPI, built with the same definitions as the tiles. */
export function buildKpiSeries(
  adRows: readonly AdRow[],
  ghl: readonly GhlKpiRow[],
  /** The period's bookings, charted on the day they're for. Omitted = the bookings among `ghl`. */
  bookings: readonly GhlKpiRow[] = ghl,
): KpiSeries {
  const adByDate: Record<string, AdRow[]> = {};
  for (const r of adRows) if (r["Report: Date"]) (adByDate[r["Report: Date"]] ??= []).push(r);
  const ghlByDate: Record<string, GhlKpiRow[]> = {};
  for (const c of ghl) if (c.created_on) (ghlByDate[c.created_on] ??= []).push(c);
  const bookedByDate: Record<string, GhlKpiRow[]> = {};
  for (const c of bookings) {
    if (!isBooked(c)) continue;
    const d = bookingDay(c);
    if (d) (bookedByDate[d] ??= []).push(c);
  }

  const adDates = Object.keys(adByDate).sort();
  const ghlDates = Object.keys(ghlByDate).sort();
  const bookedDates = Object.keys(bookedByDate).sort();
  const allDates = [...new Set([...adDates, ...ghlDates, ...bookedDates])].sort();
  const day = (date: string) =>
    computeAccountKpis(adByDate[date] ?? [], ghlByDate[date] ?? [], bookedByDate[date] ?? []);
  const round = (v: number) => +v.toFixed(3);

  const series: KpiSeries = {};
  const metaKeys: KpiKey[] = ["totalSpend", "totalClicks", "totalImpressions", "totalReach", "avgCTR", "avgCPC", "avgCPM", "webApptTotal", "apptTotal"];
  const adDays = adDates.map((date) => ({ date, k: day(date) }));
  for (const key of metaKeys) series[key] = adDays.map(({ date, k }) => ({ date, value: round(k[key]) }));
  series.ghlLeads = ghlDates.map((date) => ({ date, value: day(date).ghlLeads }));
  series.ghlAppointments = bookedDates.map((date) => ({ date, value: day(date).ghlAppointments }));
  const allDays = allDates.map((date) => ({ date, k: day(date) }));
  series.ghlCostPerLead = allDays.map(({ date, k }) => ({ date, value: +k.ghlCostPerLead.toFixed(2) }));
  series.ghlCostPerAppt = allDays.map(({ date, k }) => ({ date, value: +k.ghlCostPerAppt.toFixed(2) }));
  return series;
}

// ── Period over period ───────────────────────────────────────────────────────

/** The same number of days immediately before `range`. All time has no prior period. */
export function previousPeriod(range: DateRange | undefined): DateRange | undefined {
  if (!range?.from) return undefined;
  const from = startOfDay(range.from);
  const to = startOfDay(range.to ?? range.from);
  const days = differenceInCalendarDays(to, from) + 1;
  return { from: subDays(from, days), to: subDays(from, 1) };
}

/** "vs prior 30d" (fits a phone-width tile), plus the exact dates for a tooltip. */
export function comparisonLabel(prior: DateRange): { short: string; dates: string } {
  const from = prior.from!;
  const to = prior.to ?? from;
  const days = differenceInCalendarDays(to, from) + 1;
  return {
    short: `vs prior ${days}d`,
    dates: `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`,
  };
}

/**
 * Whether each source actually holds the prior period. A period the feed never
 * fetched would otherwise read as zero and fake a huge jump.
 *  - Meta: coupler-proxy only returns the trailing META_WINDOW_DAYS.
 *  - GHL: nothing is synced for an account before its first conversion.
 */
export function priorCoverage(
  prior: DateRange | undefined,
  ghlRows: readonly GhlKpiRow[],
  now = new Date(),
): Record<KpiSource, boolean> {
  if (!prior?.from) return { meta: false, ghl: false, blended: false };
  const priorFrom = startOfDay(prior.from);
  const metaStart = startOfDay(subDays(now, META_WINDOW_DAYS));
  const meta = priorFrom >= metaStart;
  let earliest: Date | null = null;
  for (const c of ghlRows) {
    if (!c.created_on) continue;
    const d = parseDay(c.created_on);
    if (!earliest || d < earliest) earliest = d;
  }
  const ghl = !!earliest && priorFrom >= earliest;
  return { meta, ghl, blended: meta && ghl };
}

/** Which way is good. Costs falling is good news; spend moving is neither. */
const DIRECTION: Record<KpiKey, "up" | "down" | "neutral"> = {
  totalSpend: "neutral",
  totalClicks: "up", totalImpressions: "up", totalReach: "up", avgCTR: "up",
  avgCPC: "down", avgCPM: "down",
  webApptTotal: "up", webApptCost: "down", apptTotal: "up", apptCost: "down",
  ghlLeads: "up", ghlAppointments: "up", ghlCostPerLead: "down", ghlCostPerAppt: "down",
  soldCount: "up", totalRevenue: "up", adRoi: "up",
};

/**
 * The event count a KPI rests on. A cost per lead built on 3 leads swings 30%
 * on one lead, so its change is shown but not coloured as good or bad.
 * `null` = volume metric with no small-sample problem.
 */
const BASIS: Partial<Record<KpiKey, KpiKey>> = {
  webApptTotal: "webApptTotal", webApptCost: "webApptTotal",
  apptTotal: "apptTotal", apptCost: "apptTotal",
  ghlLeads: "ghlLeads", ghlCostPerLead: "ghlLeads",
  ghlAppointments: "ghlAppointments", ghlCostPerAppt: "ghlAppointments",
  soldCount: "soldCount", totalRevenue: "soldCount", adRoi: "soldCount",
};

/** KPIs where 0 means "couldn't be computed" (no denominator), not "zero". */
const ZERO_IS_UNDEFINED = new Set<KpiKey>(["avgCTR", "avgCPC", "avgCPM", "webApptCost", "apptCost", "ghlCostPerLead", "ghlCostPerAppt", "adRoi"]);

const COUNT_KPIS = new Set<KpiKey>(["totalClicks", "totalImpressions", "totalReach", "webApptTotal", "apptTotal", "ghlLeads", "ghlAppointments", "soldCount"]);

export type KpiChange = {
  direction: "up" | "down" | "flat";
  /** What the pill says: "12%", "+3", "from 0". */
  text: string;
  tone: Status;
  /** The whole claim in words, for screen readers and the tooltip. */
  spoken: string;
};

const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

/**
 * Change of one KPI against the prior period, or `null` when no honest
 * comparison exists (prior unknown, or the ratio is undefined in either period).
 */
export function kpiChange(
  key: KpiKey,
  current: Record<KpiKey, number>,
  prior: Record<KpiKey, number>,
): KpiChange | null {
  const cur = current[key];
  const prev = prior[key];
  if (ZERO_IS_UNDEFINED.has(key) && (cur === 0 || prev === 0)) return null;
  if (cur === 0 && prev === 0) return null;

  const basisKey = BASIS[key];
  const smallSample = !!basisKey && Math.min(current[basisKey], prior[basisKey]) < MIN_EVENTS_FOR_SIGNAL;
  const judge = (dir: "up" | "down" | "flat"): Status => {
    if (dir === "flat" || smallSample || DIRECTION[key] === "neutral") return "neutral";
    return (dir === "up") === (DIRECTION[key] === "up") ? "success" : "danger";
  };
  const caveat = smallSample ? " (too few events to call)" : "";

  if (prev === 0) {
    return { direction: "up", text: "from 0", tone: judge("up"), spoken: `Up from 0${caveat}` };
  }
  // Small counts read better as the difference: "+3" says more than "+150%".
  if (smallSample && COUNT_KPIS.has(key)) {
    const diff = cur - prev;
    const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
    const text = diff === 0 ? "0" : `${diff > 0 ? "+" : "−"}${Math.abs(diff).toLocaleString("en-US")}`;
    const spoken = diff === 0 ? "No change" : `${diff > 0 ? "Up" : "Down"} ${Math.abs(diff)}${caveat}`;
    return { direction, text, tone: judge(direction), spoken };
  }
  const ratio = (cur - prev) / prev;
  const direction = Math.abs(ratio) < 0.005 ? "flat" : ratio > 0 ? "up" : "down";
  const text = direction === "flat" ? "0%" : pct.format(Math.abs(ratio));
  const spoken = direction === "flat" ? "No change" : `${direction === "up" ? "Up" : "Down"} ${text}${caveat}`;
  return { direction, text, tone: judge(direction), spoken };
}

