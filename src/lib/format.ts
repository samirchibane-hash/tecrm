// Shared number formatting. Pages call these instead of inlining
// toLocaleString so every surface rounds and abbreviates the same way.

const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const count = new Intl.NumberFormat("en-US");

/** Whole dollars: $12,480. Pass `cents: true` when the amount is in cents (Stripe). */
export function formatUsd(amount: number, opts: { cents?: boolean; decimals?: boolean } = {}): string {
  const dollars = opts.cents ? amount / 100 : amount;
  return (opts.decimals ? usd2 : usd0).format(dollars);
}

/** Axis-tick dollars: $12.5K, $1.2M. */
export function formatUsdCompact(amount: number, opts: { cents?: boolean } = {}): string {
  return usdCompact.format(opts.cents ? amount / 100 : amount);
}

export function formatCount(n: number): string {
  return count.format(n);
}

/** A value already in percent units (Meta's CTR of 1.15 means 1.15%): "1.15%". */
export function formatPercent(n: number, decimals = 2): string {
  return `${n.toFixed(decimals)}%`;
}

/** US numbers as (602) 555-0143; anything else is shown as stored. */
export function formatPhone(raw: number | string | null | undefined): string {
  if (raw == null || raw === "") return "";
  const digits = String(raw).replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return String(raw);
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}
