// Small, dependency-free statistics for judging ads and landing pages. The
// point is to never call a winner or a waster on noise: every verdict in the
// dashboard goes through one of these tests instead of a raw ratio.

/** P(X ≤ k) for X ~ Poisson(lambda). Computed in log space so large lambdas don't underflow. */
export function poissonCdf(k: number, lambda: number): number {
  if (k < 0) return 0;
  if (lambda <= 0) return 1;
  const kk = Math.floor(k);
  let logTerm = -lambda; // log P(X = 0)
  let logSum = logTerm;
  for (let i = 1; i <= kk; i++) {
    logTerm += Math.log(lambda) - Math.log(i);
    const hi = Math.max(logSum, logTerm);
    logSum = hi + Math.log(Math.exp(logSum - hi) + Math.exp(logTerm - hi));
  }
  return Math.min(1, Math.exp(logSum));
}

/** P(X ≥ k) for X ~ Poisson(lambda). */
export function poissonSf(k: number, lambda: number): number {
  return k <= 0 ? 1 : 1 - poissonCdf(k - 1, lambda);
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

/** 95% Wilson score interval for a rate; well-behaved at small counts and at 0%. */
export function wilsonInterval(successes: number, trials: number, z = 1.96): { low: number; high: number } | null {
  if (trials <= 0) return null;
  const p = Math.min(1, successes / trials);
  const z2 = z * z;
  const denom = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denom;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}

/** Two-sided p-value of a pooled two-proportion z-test. Null when either side has no trials. */
export function twoProportionPValue(s1: number, n1: number, s2: number, n2: number): number | null {
  if (n1 <= 0 || n2 <= 0) return null;
  const pooled = (s1 + s2) / (n1 + n2);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (se === 0) return 1;
  const z = (s1 / n1 - s2 / n2) / se;
  return 2 * (1 - normalCdf(Math.abs(z)));
}
