import type { Instance, NumericFeature } from '../data/dataset';
import { Random } from '../random';

/**
 * LIME (Ribeiro, Singh & Guestrin, KDD 2016) for numeric features: sample
 * points around one case, weight them by how close they are, and fit a
 * weighted linear model of the black box's probability. The weights say how
 * much each feature pushes the decision near that case.
 */
export interface LimeOptions {
  samples?: number;
  /** Spread of the samples, as a share of each feature's range. */
  spread?: number;
  /** Kernel width, as a share of the (scaled) distance: closer samples count more. */
  kernelWidth?: number;
  seed?: number;
}

export interface LimeResult {
  /** Probability ≈ intercept + Σ weights[i] × x[i], near the case (in raw units). */
  intercept: number;
  weights: number[];
  samples: { x: Instance; p: number; weight: number }[];
  /** How well the line fits the black box near the case (weighted R²). */
  r2: number;
}

export function lime(proba: (x: Instance) => number, x: Instance, features: readonly NumericFeature[], options: LimeOptions = {}): LimeResult {
  const { samples: count = 500, spread = 0.25, kernelWidth = 0.25, seed = 1 } = options;
  const rng = new Random(seed);
  const ranges = features.map((f) => f.max - f.min);
  const questions = Array.from({ length: count }, () => features.map((f, i) => Math.min(f.max, Math.max(f.min, x[i] + rng.normal() * spread * ranges[i]))));
  return fitLocal(proba, x, features, questions, kernelWidth);
}

/**
 * LIME's second half: ask the black box about the given made-up cases, weight
 * them by closeness to x, and fit the weighted linear model.
 */
export function fitLocal(proba: (x: Instance) => number, x: Instance, features: readonly NumericFeature[], questions: readonly Instance[], kernelWidth = 0.25): LimeResult {
  const ranges = features.map((f) => f.max - f.min || 1);
  const samples: LimeResult['samples'] = questions.map((z) => {
    const d2 = z.reduce((acc, v, i) => acc + ((v - x[i]) / ranges[i]) ** 2, 0);
    return { x: z, p: proba(z), weight: Math.exp(-d2 / (kernelWidth * kernelWidth)) };
  });

  // Weighted least squares on scaled features: solve (AᵀWA) β = AᵀWy.
  const k = features.length + 1;
  const ata = Array.from({ length: k }, () => new Float64Array(k));
  const aty = new Float64Array(k);
  for (const s of samples) {
    const row = [1, ...s.x.map((v, i) => (v - x[i]) / ranges[i])];
    for (let i = 0; i < k; i++) {
      aty[i] += s.weight * row[i] * s.p;
      for (let j = 0; j < k; j++) ata[i][j] += s.weight * row[i] * row[j];
    }
  }
  for (let i = 0; i < k; i++) ata[i][i] += 1e-6; // a touch of ridge for stability
  const beta = solve(ata, aty);

  // Back to raw units: p ≈ b0 + Σ b_i (v_i − x_i) / range_i.
  const weights = features.map((_, i) => beta[i + 1] / ranges[i]);
  const intercept = beta[0] - weights.reduce((acc, w, i) => acc + w * x[i], 0);

  const predict = (z: Instance) => intercept + weights.reduce((acc, w, i) => acc + w * z[i], 0);
  const totalW = samples.reduce((acc, s) => acc + s.weight, 0);
  const meanP = samples.reduce((acc, s) => acc + s.weight * s.p, 0) / totalW;
  const ssRes = samples.reduce((acc, s) => acc + s.weight * (s.p - predict(s.x)) ** 2, 0);
  const ssTot = samples.reduce((acc, s) => acc + s.weight * (s.p - meanP) ** 2, 0);
  return { intercept, weights, samples, r2: ssTot > 0 ? 1 - ssRes / ssTot : 1 };
}

export function limePredict(result: LimeResult, z: Instance): number {
  return result.intercept + result.weights.reduce((acc, w, i) => acc + w * z[i], 0);
}

/** Gaussian elimination with partial pivoting. */
function solve(a: Float64Array[], b: Float64Array): Float64Array {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    for (let r = c + 1; r < n; r++) {
      const f = m[r][c] / (m[c][c] || 1e-12);
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  const out = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n];
    for (let k = r + 1; k < n; k++) s -= m[r][k] * out[k];
    out[r] = s / (m[r][r] || 1e-12);
  }
  return out;
}
