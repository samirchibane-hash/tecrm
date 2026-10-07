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

/** Deterministic PRNG (mulberry32): the same counts always give the same chance-to-win. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number) {
  const u = Math.max(rand(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

/** Gamma(shape, 1) draw, Marsaglia–Tsang (shape < 1 boosted). */
function gamma(shape: number, rand: () => number): number {
  if (shape < 1) return gamma(shape + 1, rand) * Math.pow(Math.max(rand(), 1e-12), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = gaussian(rand);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rand();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/**
 * Chance each arm has the best true conversion rate, given successes / trials
 * per arm: Beta(1 + s, 1 + n − s) posteriors (flat prior), Monte Carlo with a
 * fixed seed so a screen never flickers between renders. This is the "chance to
 * beat" that experimentation tools show, and it answers the question an
 * operator actually asks — "how sure are we D is better?" — where a p-value
 * answers a different one.
 */
export function chanceToBeBest(arms: { successes: number; trials: number }[], draws = 20000): number[] {
  if (arms.length === 0) return [];
  if (arms.length === 1) return [1];
  const rand = mulberry32(arms.reduce((h, a) => h * 31 + a.successes * 7 + a.trials, 17));
  const wins = new Array(arms.length).fill(0);
  for (let i = 0; i < draws; i++) {
    let best = -1;
    let bestAt = 0;
    arms.forEach((a, j) => {
      const s = Math.max(0, Math.min(a.successes, a.trials));
      const x = gamma(1 + s, rand);
      const y = gamma(1 + a.trials - s, rand);
      const p = x / (x + y);
      if (p > best) {
        best = p;
        bestAt = j;
      }
    });
    wins[bestAt]++;
  }
  return wins.map((w) => w / draws);
}

/**
 * Views per arm a two-arm test needs before a gap this size reads at one-sided
 * 95% (normal approximation). Null when the arms are level, so no amount of
 * traffic would separate them.
 */
export function viewsToCall(p1: number, p2: number, z = 1.645): number | null {
  const gap = Math.abs(p1 - p2);
  if (gap <= 0) return null;
  return Math.ceil((z * z * (p1 * (1 - p1) + p2 * (1 - p2))) / (gap * gap));
}
