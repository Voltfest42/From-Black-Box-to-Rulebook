import { Random } from '../random';

/**
 * A tiny network that learns addition on a clock: given a and b, answer
 * (a + b) mod p. Each number gets a learned embedding vector; the two are
 * added and passed through one hidden ReLU layer to p outputs (softmax). The
 * same shape of model as Liu et al. (2022); Nanda et al. (2023) used a small
 * transformer. Trained full-batch with AdamW, whose weight decay is what pushes
 * it from memorising to a general algorithm ("grokking").
 */
export interface ModularOptions {
  p?: number;
  /** Share of all p² pairs used for training; the rest test generalisation. */
  trainShare?: number;
  dim?: number;
  hidden?: number;
  learningRate?: number;
  weightDecay?: number;
  seed?: number;
}

export interface ModularEpoch {
  loss: number;
  trainAccuracy: number;
}

export class ModularNet {
  readonly p: number;
  readonly dim: number;
  readonly hidden: number;
  /** p × dim embeddings, row by row. */
  readonly embed: Float64Array;
  readonly train: [number, number][];
  readonly test: [number, number][];
  epochs = 0;

  private readonly w1: Float64Array;
  private readonly b1: Float64Array;
  private readonly w2: Float64Array;
  private readonly b2: Float64Array;
  private readonly params: Float64Array[];
  private readonly m: Float64Array[];
  private readonly v: Float64Array[];
  private readonly learningRate: number;
  private readonly weightDecay: number;

  constructor(options: ModularOptions = {}) {
    const { p = 23, trainShare = 0.5, dim = 24, hidden = 64, learningRate = 0.005, weightDecay = 1, seed = 1 } = options;
    this.p = p;
    this.dim = dim;
    this.hidden = hidden;
    this.learningRate = learningRate;
    this.weightDecay = weightDecay;
    const rng = new Random(seed);
    const init = (n: number, scale: number) => Float64Array.from({ length: n }, () => rng.normal() * scale);
    this.embed = init(p * dim, 1 / Math.sqrt(dim));
    this.w1 = init(hidden * dim, 1 / Math.sqrt(dim));
    this.b1 = new Float64Array(hidden);
    this.w2 = init(p * hidden, 1 / Math.sqrt(hidden));
    this.b2 = new Float64Array(p);
    this.params = [this.embed, this.w1, this.b1, this.w2, this.b2];
    this.m = this.params.map((q) => new Float64Array(q.length));
    this.v = this.params.map((q) => new Float64Array(q.length));

    const pairs: [number, number][] = [];
    for (let a = 0; a < p; a++) for (let b = 0; b < p; b++) pairs.push([a, b]);
    const shuffled = rng.shuffled(pairs);
    const cut = Math.round(trainShare * pairs.length);
    this.train = shuffled.slice(0, cut);
    this.test = shuffled.slice(cut);
  }

  /** The network's answer for a + b (mod p). */
  predict(a: number, b: number): number {
    const logits = this.forward(a, b).logits;
    let best = 0;
    for (let c = 1; c < this.p; c++) if (logits[c] > logits[best]) best = c;
    return best;
  }

  accuracy(pairs: readonly [number, number][]): number {
    if (pairs.length === 0) return 1;
    return pairs.filter(([a, b]) => this.predict(a, b) === (a + b) % this.p).length / pairs.length;
  }

  /** One full-batch AdamW step on the training pairs. */
  epoch(): ModularEpoch {
    const { p, dim, hidden } = this;
    const grads = this.params.map((q) => new Float64Array(q.length));
    const [gE, gW1, gB1, gW2, gB2] = grads;
    let loss = 0;
    let right = 0;
    for (const [a, b] of this.train) {
      const { e, z1, h, logits } = this.forward(a, b);
      const target = (a + b) % p;
      let max = -Infinity;
      for (let c = 0; c < p; c++) max = Math.max(max, logits[c]);
      let sum = 0;
      const probs = new Float64Array(p);
      for (let c = 0; c < p; c++) sum += probs[c] = Math.exp(logits[c] - max);
      let best = 0;
      for (let c = 0; c < p; c++) {
        probs[c] /= sum;
        if (logits[c] > logits[best]) best = c;
      }
      if (best === target) right++;
      loss -= Math.log(Math.max(probs[target], 1e-12));
      probs[target] -= 1;
      const dh = new Float64Array(hidden);
      for (let c = 0; c < p; c++) {
        const g = probs[c];
        gB2[c] += g;
        for (let j = 0; j < hidden; j++) {
          gW2[c * hidden + j] += g * h[j];
          dh[j] += g * this.w2[c * hidden + j];
        }
      }
      const de = new Float64Array(dim);
      for (let j = 0; j < hidden; j++) {
        if (z1[j] <= 0) continue;
        const g = dh[j];
        gB1[j] += g;
        for (let k = 0; k < dim; k++) {
          gW1[j * dim + k] += g * e[k];
          de[k] += g * this.w1[j * dim + k];
        }
      }
      for (let k = 0; k < dim; k++) {
        gE[a * dim + k] += de[k];
        gE[b * dim + k] += de[k];
      }
    }

    // AdamW: Adam on the gradient, plus weight decay applied directly to the weights.
    this.epochs++;
    const n = this.train.length;
    const [beta1, beta2] = [0.9, 0.98];
    const c1 = 1 - beta1 ** this.epochs;
    const c2 = 1 - beta2 ** this.epochs;
    this.params.forEach((q, i) => {
      const g = grads[i];
      const m = this.m[i];
      const v = this.v[i];
      for (let j = 0; j < q.length; j++) {
        const gj = g[j] / n;
        m[j] = beta1 * m[j] + (1 - beta1) * gj;
        v[j] = beta2 * v[j] + (1 - beta2) * gj * gj;
        q[j] -= this.learningRate * ((m[j] / c1) / (Math.sqrt(v[j] / c2) + 1e-8) + this.weightDecay * q[j]);
      }
    });

    return { loss: loss / n, trainAccuracy: right / n };
  }

  private forward(a: number, b: number) {
    const { dim, hidden, p } = this;
    const e = new Float64Array(dim);
    for (let k = 0; k < dim; k++) e[k] = this.embed[a * dim + k] + this.embed[b * dim + k];
    const z1 = new Float64Array(hidden);
    const h = new Float64Array(hidden);
    for (let j = 0; j < hidden; j++) {
      let s = this.b1[j];
      for (let k = 0; k < dim; k++) s += this.w1[j * dim + k] * e[k];
      z1[j] = s;
      h[j] = s > 0 ? s : 0;
    }
    const logits = new Float64Array(p);
    for (let c = 0; c < p; c++) {
      let s = this.b2[c];
      for (let j = 0; j < hidden; j++) s += this.w2[c * hidden + j] * h[j];
      logits[c] = s;
    }
    return { e, z1, h, logits };
  }
}

/**
 * How strongly the embeddings use each frequency k = 1 … (p−1)/2: the share of
 * their (non-constant) energy in the cosine and sine waves that go round the
 * clock k times. A network that has found the clock algorithm uses only a few.
 */
export function frequencyPower(net: ModularNet): number[] {
  const { p, dim, embed } = net;
  const power: number[] = [];
  let total = 0;
  for (let k = 1; k <= (p - 1) / 2; k++) {
    let s = 0;
    for (let d = 0; d < dim; d++) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < p; n++) {
        re += embed[n * dim + d] * Math.cos((2 * Math.PI * k * n) / p);
        im += embed[n * dim + d] * Math.sin((2 * Math.PI * k * n) / p);
      }
      s += re * re + im * im;
    }
    power.push(s);
    total += s;
  }
  return power.map((s) => s / (total || 1));
}

/**
 * Projects every number's embedding onto the plane of frequency k: the
 * directions that best match cos(2πkn/p) and sin(2πkn/p). If the network uses
 * frequency k, the numbers land on a circle, k steps of the clock apart.
 */
export function clockProjection(net: ModularNet, k: number): [number, number][] {
  const { p, dim, embed } = net;
  const cosDir = new Float64Array(dim);
  const sinDir = new Float64Array(dim);
  for (let n = 0; n < p; n++)
    for (let d = 0; d < dim; d++) {
      cosDir[d] += embed[n * dim + d] * Math.cos((2 * Math.PI * k * n) / p);
      sinDir[d] += embed[n * dim + d] * Math.sin((2 * Math.PI * k * n) / p);
    }
  const norm = (v: Float64Array) => Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  const [nc, ns] = [norm(cosDir), norm(sinDir)];
  const mean = new Float64Array(dim);
  for (let n = 0; n < p; n++) for (let d = 0; d < dim; d++) mean[d] += embed[n * dim + d] / p;
  return Array.from({ length: p }, (_, n) => {
    let x = 0;
    let y = 0;
    for (let d = 0; d < dim; d++) {
      const v = embed[n * dim + d] - mean[d];
      x += (v * cosDir[d]) / nc;
      y += (v * sinDir[d]) / ns;
    }
    return [x, y] as [number, number];
  });
}
