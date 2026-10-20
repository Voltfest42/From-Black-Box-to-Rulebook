import { Random } from '../random';

export type Activation = 'tanh' | 'relu' | 'sigmoid';

export interface MlpOptions {
  activation?: Activation;
  seed?: number;
}

/**
 * A small fully connected network with one output: the probability of "yes".
 * Hidden layers use `activation`; the output is a sigmoid. Weights are stored
 * per layer, row-major: W[l][j * inputs + i] connects input i to unit j.
 */
export class Mlp {
  readonly sizes: readonly number[];
  readonly activation: Activation;
  readonly W: Float64Array[];
  readonly b: Float64Array[];

  constructor(inputs: number, hidden: readonly number[], { activation = 'tanh', seed = 1 }: MlpOptions = {}) {
    this.sizes = [inputs, ...hidden, 1];
    this.activation = activation;
    const rng = new Random(seed);
    this.W = [];
    this.b = [];
    for (let l = 0; l + 1 < this.sizes.length; l++) {
      const fanIn = this.sizes[l];
      const fanOut = this.sizes[l + 1];
      // Glorot/Xavier uniform initialisation.
      const limit = Math.sqrt(6 / (fanIn + fanOut));
      const w = new Float64Array(fanIn * fanOut);
      for (let k = 0; k < w.length; k++) w[k] = rng.uniform(-limit, limit);
      this.W.push(w);
      this.b.push(new Float64Array(fanOut));
    }
  }

  get layers(): number {
    return this.W.length;
  }

  /** P(yes) for an encoded input. */
  predict(x: ArrayLike<number>): number {
    const acts = this.forward(x);
    return acts[acts.length - 1][0];
  }

  /**
   * The output of every layer, input first. Hidden layers hold activations;
   * the last holds the output probability.
   */
  forward(x: ArrayLike<number>): Float64Array[] {
    const acts: Float64Array[] = [Float64Array.from(x)];
    for (let l = 0; l < this.W.length; l++) {
      const input = acts[l];
      const n = this.sizes[l];
      const m = this.sizes[l + 1];
      const w = this.W[l];
      const out = new Float64Array(m);
      const last = l === this.W.length - 1;
      for (let j = 0; j < m; j++) {
        let z = this.b[l][j];
        const row = j * n;
        for (let i = 0; i < n; i++) z += w[row + i] * input[i];
        out[j] = last ? sigmoid(z) : activate(z, this.activation);
      }
      acts.push(out);
    }
    return acts;
  }

  /** The output unit's input before the sigmoid (log-odds of "yes"). */
  logit(x: ArrayLike<number>): number {
    const p = this.predict(x);
    return Math.log(Math.max(p, 1e-15) / Math.max(1 - p, 1e-15));
  }

  clone(): Mlp {
    const copy = Object.create(Mlp.prototype) as Mlp;
    Object.assign(copy, {
      sizes: this.sizes,
      activation: this.activation,
      W: this.W.map((w) => w.slice()),
      b: this.b.map((b) => b.slice()),
    });
    return copy;
  }

  /** Number of weights and biases. */
  get parameterCount(): number {
    return this.W.reduce((s, w) => s + w.length, 0) + this.b.reduce((s, b) => s + b.length, 0);
  }

  toJSON(): { sizes: number[]; activation: Activation; W: number[][]; b: number[][] } {
    return { sizes: [...this.sizes], activation: this.activation, W: this.W.map((w) => Array.from(w)), b: this.b.map((b) => Array.from(b)) };
  }

  static fromJSON(data: { sizes: number[]; activation: Activation; W: number[][]; b: number[][] }): Mlp {
    const net = new Mlp(data.sizes[0], data.sizes.slice(1, -1), { activation: data.activation });
    data.W.forEach((w, l) => net.W[l].set(w));
    data.b.forEach((b, l) => net.b[l].set(b));
    return net;
  }
}

export interface TrainOptions {
  learningRate?: number;
  /** Examples per update; the whole set when absent. */
  batchSize?: number;
  /** L2 penalty on weights (not biases), which keeps weights small and readable. */
  l2?: number;
  seed?: number;
  /** Per-example weights (default 1). */
  weights?: readonly number[];
}

/**
 * Trains an Mlp with Adam on binary cross-entropy, one epoch at a time, so a
 * figure can show the loss falling as it happens.
 */
export class Trainer {
  readonly net: Mlp;
  private readonly X: readonly ArrayLike<number>[];
  private readonly y: readonly number[];
  private readonly options: Required<Omit<TrainOptions, 'batchSize' | 'weights'>> & { batchSize: number; weights?: readonly number[] };
  private readonly rng: Random;
  private readonly mW: Float64Array[];
  private readonly vW: Float64Array[];
  private readonly mb: Float64Array[];
  private readonly vb: Float64Array[];
  private t = 0;
  epochs = 0;

  constructor(net: Mlp, X: readonly ArrayLike<number>[], y: readonly number[], options: TrainOptions = {}) {
    this.net = net;
    this.X = X;
    this.y = y;
    this.options = {
      learningRate: options.learningRate ?? 0.01,
      batchSize: options.batchSize ?? X.length,
      l2: options.l2 ?? 0,
      seed: options.seed ?? 1,
      weights: options.weights,
    };
    this.rng = new Random(this.options.seed + 7919);
    this.mW = net.W.map((w) => new Float64Array(w.length));
    this.vW = net.W.map((w) => new Float64Array(w.length));
    this.mb = net.b.map((b) => new Float64Array(b.length));
    this.vb = net.b.map((b) => new Float64Array(b.length));
  }

  /** One pass over the data. Returns the mean loss during the pass. */
  epoch(): number {
    const order = this.rng.shuffled(this.X.map((_, i) => i));
    let total = 0;
    for (let start = 0; start < order.length; start += this.options.batchSize) {
      total += this.step(order.slice(start, start + this.options.batchSize));
    }
    this.epochs++;
    return total / this.X.length;
  }

  /** Mean cross-entropy over the whole training set (with the current weights). */
  loss(): number {
    let total = 0;
    for (let i = 0; i < this.X.length; i++) total += this.weightOf(i) * crossEntropy(this.net.predict(this.X[i]), this.y[i]);
    return total / this.X.length;
  }

  private weightOf(i: number): number {
    return this.options.weights ? this.options.weights[i] : 1;
  }

  /** One Adam update on a batch. Returns the summed (weighted) loss of the batch. */
  private step(batch: readonly number[]): number {
    const net = this.net;
    const { loss, gW, gb } = lossGradients(net, this.X, this.y, batch, this.options.weights);
    const scale = 1 / batch.length;
    const { learningRate, l2 } = this.options;
    const beta1 = 0.9;
    const beta2 = 0.999;
    this.t++;
    const c1 = 1 - beta1 ** this.t;
    const c2 = 1 - beta2 ** this.t;
    for (let l = 0; l < net.W.length; l++) {
      adam(net.W[l], gW[l], this.mW[l], this.vW[l], scale, l2, learningRate, beta1, beta2, c1, c2);
      adam(net.b[l], gb[l], this.mb[l], this.vb[l], scale, 0, learningRate, beta1, beta2, c1, c2);
    }
    return loss;
  }
}

/**
 * Backpropagation: the summed cross-entropy over `rows`, and its gradient with
 * respect to every weight and bias.
 */
export function lossGradients(
  net: Mlp,
  X: readonly ArrayLike<number>[],
  y: readonly number[],
  rows: readonly number[],
  weights?: readonly number[],
): { loss: number; gW: Float64Array[]; gb: Float64Array[] } {
  const gW = net.W.map((w) => new Float64Array(w.length));
  const gb = net.b.map((b) => new Float64Array(b.length));
  let loss = 0;

  for (const i of rows) {
    const acts = net.forward(X[i]);
    const out = acts[acts.length - 1][0];
    const weight = weights ? weights[i] : 1;
    loss += weight * crossEntropy(out, y[i]);
    // Sigmoid + cross-entropy: d loss / d z = p − y.
    let delta = new Float64Array([weight * (out - y[i])]);
    for (let l = net.W.length - 1; l >= 0; l--) {
      const n = net.sizes[l];
      const m = net.sizes[l + 1];
      const input = acts[l];
      const w = net.W[l];
      for (let j = 0; j < m; j++) {
        const d = delta[j];
        if (d === 0) continue;
        gb[l][j] += d;
        const row = j * n;
        for (let k = 0; k < n; k++) gW[l][row + k] += d * input[k];
      }
      if (l === 0) break;
      const prev = new Float64Array(n);
      for (let k = 0; k < n; k++) {
        let s = 0;
        for (let j = 0; j < m; j++) s += w[j * n + k] * delta[j];
        prev[k] = s * derivative(input[k], net.activation);
      }
      delta = prev;
    }
  }
  return { loss, gW, gb };
}

function adam(
  p: Float64Array,
  g: Float64Array,
  m: Float64Array,
  v: Float64Array,
  scale: number,
  l2: number,
  lr: number,
  beta1: number,
  beta2: number,
  c1: number,
  c2: number,
): void {
  for (let k = 0; k < p.length; k++) {
    const grad = g[k] * scale + l2 * p[k];
    m[k] = beta1 * m[k] + (1 - beta1) * grad;
    v[k] = beta2 * v[k] + (1 - beta2) * grad * grad;
    p[k] -= (lr * (m[k] / c1)) / (Math.sqrt(v[k] / c2) + 1e-8);
  }
}

export function sigmoid(z: number): number {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

function activate(z: number, activation: Activation): number {
  switch (activation) {
    case 'tanh':
      return Math.tanh(z);
    case 'relu':
      return z > 0 ? z : 0;
    case 'sigmoid':
      return sigmoid(z);
  }
}

/** The activation's derivative, written in terms of its output a. */
function derivative(a: number, activation: Activation): number {
  switch (activation) {
    case 'tanh':
      return 1 - a * a;
    case 'relu':
      return a > 0 ? 1 : 0;
    case 'sigmoid':
      return a * (1 - a);
  }
}

export function crossEntropy(p: number, y: number): number {
  const q = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  return y === 1 ? -Math.log(q) : -Math.log(1 - q);
}
