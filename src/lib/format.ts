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
