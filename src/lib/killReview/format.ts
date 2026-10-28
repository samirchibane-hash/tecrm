import { format, parseISO } from "date-fns";
import { formatCount, formatPercent, formatUsd } from "@/lib/format";

export function formatKillMoney(amount: number): string {
  return formatUsd(amount, { decimals: true });
}

/** A missing rate is an em dash. Zero is a real zero and is formatted. */
export function formatKillMoneyOrDash(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return formatKillMoney(amount);
}

export function formatKillLeads(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? formatCount(rounded) : rounded.toFixed(1);
}

export function formatKillPercentOrDash(n: number | null | undefined): string {
  if (n == null) return "—";
  return formatPercent(n);
}

export function formatKillDay(iso: string): string {
  return format(parseISO(iso), "MMM d");
}

export function formatKillRange(since: string, until: string): string {
  const start = parseISO(since);
  const end = parseISO(until);
  if (since === until) return format(start, "MMM d");
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${format(start, "MMM d")}–${format(end, "d")}`;
  }
  return `${format(start, "MMM d")}–${format(end, "MMM d")}`;
}

export function formatSince(spend: number, on: string | null, empty: string): string {
  const money = formatKillMoney(spend);
  if (!on) return `${money} · ${empty}`;
  return `${money} · last ${formatKillDay(on)}`;
}
