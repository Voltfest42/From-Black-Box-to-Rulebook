import type { Feature, Instance, NumericFeature } from '../data/dataset';
import { forestRules, randomForest, type Forest } from '../models/forest';
import { sigmoid } from '../models/mlp';
import { fires, type Test } from '../rules/rule';

/* ---------------- RuleFit (Friedman & Popescu, 2008) ---------------- */

export interface WeightedRule {
  tests: Test[];
  weight: number;
}

export interface RuleFitStep {
  lambda: number;
  intercept: number;
  /** The rules with a non-zero weight at this penalty. */
  rules: WeightedRule[];
}

/**
 * RuleFit: take every rule in a forest, then fit a logistic model on the rules'
 * 0/1 indicators with an L1 (lasso) penalty. The penalty pushes most weights to
 * exactly zero; lowering it lets more rules in. Returns the whole path, from the
 * strongest penalty (no rules) down.
 *
 * Fitted by proximal gradient descent (FISTA), warm-started along the path.
 */
export function ruleFitPath(candidates: readonly { tests: Test[] }[], X: readonly Instance[], y: readonly number[], steps = 24, minRatio = 0.004): RuleFitStep[] {
  const n = X.length;
  const k = candidates.length;
  // Indicator matrix, stored by rule as the list of cases it covers.
  const covers = candidates.map((c) => X.flatMap((x, i) => (fires({ tests: c.tests, prediction: 1 }, x) ? [i] : [])));
  const mean = y.reduce((s, v) => s + v, 0) / n;
  let intercept = Math.log(Math.max(mean, 1e-6) / Math.max(1 - mean, 1e-6));
  const beta = new Float64Array(k);

  const gradient = (b0: number, b: Float64Array) => {
    const z = new Float64Array(n).fill(b0);
    b.forEach((w, j) => {
      if (w !== 0) for (const i of covers[j]) z[i] += w;
    });
    const r = new Float64Array(n);
    for (let i = 0; i < n; i++) r[i] = sigmoid(z[i]) - y[i];
    const g = new Float64Array(k);
    for (let j = 0; j < k; j++) {
      let s = 0;
      for (const i of covers[j]) s += r[i];
      g[j] = s / n;
    }
    return { g, g0: r.reduce((s, v) => s + v, 0) / n };
  };

  const { g } = gradient(intercept, beta);
  const lambdaMax = Math.max(...Array.from(g, Math.abs), 1e-9);
  const path: RuleFitStep[] = [];
  // Step 1/L, where L bounds the curvature of the logistic loss: ¼ × the largest
  // eigenvalue of AᵀA/n for the indicator matrix A (with a column of ones).
  const eta = 1 / (0.25 * largestEigenvalue(covers, n) + 1e-9);

  for (let s = 0; s < steps; s++) {
    const lambda = lambdaMax * minRatio ** (s / (steps - 1));
    let b = beta.slice();
    let b0 = intercept;
    const yb = b.slice();
    let yb0 = b0;
    let t = 1;
    for (let it = 0; it < 200; it++) {
      const { g: gr, g0 } = gradient(yb0, yb);
      const next = new Float64Array(k);
      for (let j = 0; j < k; j++) {
        const v = yb[j] - eta * gr[j];
        next[j] = Math.sign(v) * Math.max(0, Math.abs(v) - eta * lambda);
      }
      const next0 = yb0 - eta * g0;
      const tNext = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
      let change = Math.abs(next0 - b0);
      for (let j = 0; j < k; j++) {
        change = Math.max(change, Math.abs(next[j] - b[j]));
        yb[j] = next[j] + ((t - 1) / tNext) * (next[j] - b[j]);
      }
      yb0 = next0 + ((t - 1) / tNext) * (next0 - b0);
      b = next;
      b0 = next0;
      t = tNext;
      if (change < 1e-5) break;
    }
    beta.set(b);
    intercept = b0;
    path.push({
      lambda,
      intercept,
      rules: Array.from(beta).flatMap((w, j) => (Math.abs(w) > 1e-6 ? [{ tests: candidates[j].tests, weight: w }] : [])),
    });
  }
  return path;
}

/** Largest eigenvalue of AᵀA / n by power iteration; A's columns are the rules plus an intercept. */
function largestEigenvalue(covers: readonly number[][], n: number): number {
  const k = covers.length;
  let v = new Float64Array(k + 1).fill(1 / Math.sqrt(k + 1));
  let value = 1;
  for (let it = 0; it < 30; it++) {
    const av = new Float64Array(n).fill(v[k]);
    covers.forEach((rows, j) => {
      for (const i of rows) av[i] += v[j];
    });
    const next = new Float64Array(k + 1);
    covers.forEach((rows, j) => {
      let s = 0;
      for (const i of rows) s += av[i];
      next[j] = s / n;
    });
    next[k] = av.reduce((s, x) => s + x, 0) / n;
    value = Math.hypot(...next);
    v = next.map((x) => x / (value || 1));
  }
  return value;
}

export function ruleFitProba(step: RuleFitStep, x: Instance): number {
  let z = step.intercept;
  for (const r of step.rules) if (fires({ tests: r.tests, prediction: 1 }, x)) z += r.weight;
  return sigmoid(z);
}

/* ---------------- SIRUS (Bénard, Biau, Da Veiga & Scornet, 2021) ---------------- */

export interface SirusRule {
  tests: Test[];
  /** Share of trees containing the rule. */
  frequency: number;
  /** P(yes) among training cases where the rule fires, and where it doesn't. */
  inside: number;
  outside: number;
}

/** Thresholds at the q-quantiles of each numeric feature in the data. */
export function quantileThresholds(features: readonly Feature[], X: readonly Instance[], q = 10): Map<number, number[]> {
  const out = new Map<number, number[]>();
  features.forEach((f, i) => {
    if (f.kind !== 'numeric') return;
    const sorted = X.map((x) => x[i]).sort((a, b) => a - b);
    const ts = new Set<number>();
    for (let k = 1; k < q; k++) ts.add(sorted[Math.floor((k / q) * (sorted.length - 1))]);
    out.set(i, [...ts].sort((a, b) => a - b));
  });
  return out;
}

/**
 * SIRUS: grow many shallow trees whose splits are restricted to quantiles, so
 * the same rules turn up again and again, and keep the rules that appear in at
 * least a share p₀ of the trees. The model averages the kept rules' estimates.
 */
export function sirus(features: readonly Feature[], X: readonly Instance[], y: readonly number[], { trees = 1000, q = 10, seed = 1 } = {}): { forest: Forest; ranked: SirusRule[] } {
  const thresholds = quantileThresholds(features, X, q);
  const forest = randomForest(features, X, y, { trees, maxDepth: 2, thresholds, seed });
  const ranked = forestRules(forest, features)
    .map(({ tests, count }) => {
      let nIn = 0;
      let yIn = 0;
      let yOut = 0;
      X.forEach((x, i) => {
        if (fires({ tests, prediction: 1 }, x)) {
          nIn++;
          yIn += y[i];
        } else yOut += y[i];
      });
      const nOut = X.length - nIn;
      return { tests, frequency: count / trees, inside: nIn ? yIn / nIn : 0.5, outside: nOut ? yOut / nOut : 0.5 };
    })
    .sort((a, b) => b.frequency - a.frequency || a.tests.length - b.tests.length);
  return { forest, ranked: dropRedundant(ranked, X) };
}

/**
 * SIRUS's last step: a rule that fires on exactly the same training cases as a
 * more frequent one, or on exactly the others, adds nothing (it is a copy or the
 * complement), so it is dropped.
 */
function dropRedundant(ranked: SirusRule[], X: readonly Instance[]): SirusRule[] {
  const seen = new Set<string>();
  return ranked.filter((r) => {
    const pattern = X.map((x) => (fires({ tests: r.tests, prediction: 1 }, x) ? '1' : '0')).join('');
    const complement = pattern.replace(/[01]/g, (c) => (c === '1' ? '0' : '1'));
    if (seen.has(pattern) || seen.has(complement)) return false;
    seen.add(pattern);
    return true;
  });
}

export function sirusProba(rules: readonly SirusRule[], x: Instance): number {
  if (rules.length === 0) return 0.5;
  let s = 0;
  for (const r of rules) s += fires({ tests: r.tests, prediction: 1 }, x) ? r.inside : r.outside;
  return s / rules.length;
}

/* ---------------- stability ---------------- */

/**
 * Do two rules say the same thing? Same features, same directions, thresholds
 * within `tolerance` of each feature's range.
 */
export function sameRule(a: readonly Test[], b: readonly Test[], features: readonly Feature[], tolerance = 0.03): boolean {
  if (a.length !== b.length) return false;
  return a.every((t) =>
    b.some((u) => {
      if (t.kind === 'num' && u.kind === 'num') {
        if (t.feature !== u.feature) return false;
        const f = features[t.feature] as NumericFeature;
        return t.above === u.above && Math.abs(t.threshold - u.threshold) <= tolerance * (f.max - f.min);
      }
      return JSON.stringify(t) === JSON.stringify(u);
    }),
  );
}

/** Share of rules in `a` that also appear (by sameRule) in `b`. */
export function overlap(a: readonly { tests: Test[] }[], b: readonly { tests: Test[] }[], features: readonly Feature[]): number {
  if (a.length === 0) return 1;
  return a.filter((r) => b.some((s) => sameRule(r.tests, s.tests, features))).length / a.length;
}
