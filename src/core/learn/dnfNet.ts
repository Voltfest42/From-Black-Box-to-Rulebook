import { Random } from '../random';

/**
 * A network that *is* a rule set, in the spirit of DR-Net (Qiao, Wang & Lin,
 * 2021) and RRL (Wang et al., 2021): trained by gradient descent like any
 * network, but built so that, once trained, it reads as IF–THEN rules.
 *
 * Inputs are yes/no literals ("jacket is red"). Each of K "AND" units has a
 * soft membership wᵢ ∈ (0, 1) per literal, and computes
 *   ANDₖ = Πᵢ (1 − wₖᵢ (1 − xᵢ)),
 * which is 1 when every literal it includes is true. The output is a soft OR of
 * the units it includes (membership vₖ):
 *   OR = 1 − Πₖ (1 − vₖ ANDₖ).
 * An L1 penalty on the memberships pushes most of them to 0, and rounding the
 * rest to 0 or 1 gives the rules.
 */
export interface DnfOptions {
  rules?: number;
  learningRate?: number;
  /** L1 penalty on literal memberships (sparser rules). */
  sparsity?: number;
  seed?: number;
}

export class DnfNet {
  readonly literals: number;
  readonly rules: number;
  /** Raw parameters: memberships are sigmoid(a) and sigmoid(b). */
  readonly a: Float64Array;
  readonly b: Float64Array;
  private readonly m: Float64Array;
  private readonly v: Float64Array;
  private t = 0;
  epochs = 0;
  private readonly learningRate: number;
  private readonly sparsity: number;
  private readonly rng: Random;
  private readonly X: readonly (readonly number[])[];
  private readonly y: readonly number[];

  constructor(X: readonly (readonly number[])[], y: readonly number[], { rules = 6, learningRate = 0.05, sparsity = 0.003, seed = 1 }: DnfOptions = {}) {
    this.X = X;
    this.y = y;
    this.literals = X[0].length;
    this.rules = rules;
    this.learningRate = learningRate;
    this.sparsity = sparsity;
    this.rng = new Random(seed);
    this.a = Float64Array.from({ length: rules * this.literals }, () => this.rng.uniform(-4, 0));
    this.b = Float64Array.from({ length: rules }, () => this.rng.uniform(-0.5, 0.5));
    this.m = new Float64Array(this.a.length + this.b.length);
    this.v = new Float64Array(this.a.length + this.b.length);
  }

  membership(k: number, i: number): number {
    return sigmoid(this.a[k * this.literals + i]);
  }

  ruleWeight(k: number): number {
    return sigmoid(this.b[k]);
  }

  /** The soft output for one case, and the AND units' values. */
  forward(x: readonly number[]): { out: number; ands: number[] } {
    const ands: number[] = [];
    let notOut = 1;
    for (let k = 0; k < this.rules; k++) {
      let and = 1;
      for (let i = 0; i < this.literals; i++) and *= 1 - this.membership(k, i) * (1 - x[i]);
      ands.push(and);
      notOut *= 1 - this.ruleWeight(k) * and;
    }
    return { out: 1 - notOut, ands };
  }

  /** One pass over the data (full batch). Returns the mean cross-entropy. */
  epoch(): number {
    const L = this.literals;
    const K = this.rules;
    const ga = new Float64Array(this.a.length);
    const gb = new Float64Array(this.b.length);
    let loss = 0;
    const n = this.X.length;
    // Memberships don't change within an epoch: compute them once.
    const w = Array.from({ length: K }, (_, k) => Array.from({ length: L }, (_, i) => this.membership(k, i)));
    const vk = Array.from({ length: K }, (_, k) => this.ruleWeight(k));
    for (let s = 0; s < n; s++) {
      const x = this.X[s];
      const y = this.y[s];
      // Forward, keeping the factors.
      const factor = w.map((row) => row.map((wi, i) => 1 - wi * (1 - x[i])));
      const ands = factor.map((row) => row.reduce((p, f) => p * f, 1));
      const terms = ands.map((and, k) => 1 - vk[k] * and);
      const notOut = terms.reduce((p, t) => p * t, 1);
      const out = Math.min(1 - 1e-7, Math.max(1e-7, 1 - notOut));
      loss += y === 1 ? -Math.log(out) : -Math.log(1 - out);
      const dOut = (out - y) / (out * (1 - out)); // d loss / d out
      for (let k = 0; k < K; k++) {
        const others = productExcept(terms, k);
        // out = 1 − Π terms; d out / d(v_k AND_k) = Π_{j≠k} terms_j
        const dProduct = dOut * others;
        gb[k] += dProduct * ands[k] * vk[k] * (1 - vk[k]);
        const dAnd = dProduct * vk[k];
        for (let i = 0; i < L; i++) {
          if (x[i] === 1) continue; // the factor is 1 whatever w is
          const rest = productExcept(factor[k], i);
          // d AND / d w = −(1 − x) Π_{j≠i} factor_j
          ga[k * L + i] += dAnd * -rest * w[k][i] * (1 - w[k][i]);
        }
      }
    }
    // Sparsity: L1 on memberships (they're positive), through the sigmoid.
    for (let k = 0; k < K; k++) {
      for (let i = 0; i < L; i++) {
        const wi = w[k][i];
        ga[k * L + i] = ga[k * L + i] / n + this.sparsity * wi * (1 - wi);
      }
      gb[k] /= n;
    }
    this.adam(ga, gb);
    this.epochs++;
    return loss / n;
  }

  private adam(ga: Float64Array, gb: Float64Array): void {
    this.t++;
    const c1 = 1 - 0.9 ** this.t;
    const c2 = 1 - 0.999 ** this.t;
    const all = [...ga, ...gb];
    all.forEach((g, k) => {
      this.m[k] = 0.9 * this.m[k] + 0.1 * g;
      this.v[k] = 0.999 * this.v[k] + 0.001 * g * g;
      const step = (this.learningRate * (this.m[k] / c1)) / (Math.sqrt(this.v[k] / c2) + 1e-8);
      if (k < this.a.length) this.a[k] -= step;
      else this.b[k - this.a.length] -= step;
    });
  }

  /** Round to rules: each included AND unit becomes the conjunction of its included literals. */
  extract(threshold = 0.5): number[][] {
    const out: number[][] = [];
    for (let k = 0; k < this.rules; k++) {
      if (this.ruleWeight(k) < threshold) continue;
      const literals: number[] = [];
      for (let i = 0; i < this.literals; i++) if (this.membership(k, i) >= threshold) literals.push(i);
      out.push(literals);
    }
    // Drop exact duplicates and rules implied by shorter ones (they add nothing).
    return out
      .sort((p, q) => p.length - q.length)
      .filter((r, idx, all) => !all.slice(0, idx).some((s) => s.every((l) => r.includes(l))));
  }
}

function productExcept(values: readonly number[], skip: number): number {
  let p = 1;
  for (let i = 0; i < values.length; i++) if (i !== skip) p *= values[i];
  return p;
}

function sigmoid(z: number): number {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}
