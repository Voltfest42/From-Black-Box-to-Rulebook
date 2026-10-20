import { Random } from '../random';
import { sigmoid } from './mlp';

/**
 * A small recurrent network (Elman, 1990) that reads one symbol at a time:
 *   hₜ = tanh(Wx·xₜ + Wh·hₜ₋₁ + b),   pₜ = sigmoid(v·hₜ + c)
 * where xₜ is the one-hot symbol and pₜ the probability of "fire now".
 * All parameters live in one array so training is one loop.
 */
export class Rnn {
  readonly symbols: number;
  readonly hidden: number;
  readonly theta: Float64Array;
  private readonly offsets: { wx: number; wh: number; b: number; v: number; c: number };

  constructor(symbols: number, hidden: number, seed = 1) {
    this.symbols = symbols;
    this.hidden = hidden;
    const wx = 0;
    const wh = wx + hidden * symbols;
    const b = wh + hidden * hidden;
    const v = b + hidden;
    const c = v + hidden;
    this.offsets = { wx, wh, b, v, c };
    this.theta = new Float64Array(c + 1);
    const rng = new Random(seed);
    for (let k = 0; k < hidden * symbols; k++) this.theta[wx + k] = rng.uniform(-1, 1);
    const limit = 1 / Math.sqrt(hidden);
    for (let k = 0; k < hidden * hidden; k++) this.theta[wh + k] = rng.uniform(-limit, limit);
    for (let k = 0; k < hidden; k++) this.theta[v + k] = rng.uniform(-limit, limit);
  }

  /** The start state h₀ (all zeros). */
  initialState(): Float64Array {
    return new Float64Array(this.hidden);
  }

  /** One step: the next state after reading `symbol`. */
  step(h: ArrayLike<number>, symbol: number): Float64Array {
    const { wx, wh, b } = this.offsets;
    const H = this.hidden;
    const next = new Float64Array(H);
    for (let j = 0; j < H; j++) {
      let z = this.theta[b + j] + this.theta[wx + j * this.symbols + symbol];
      for (let k = 0; k < H; k++) z += this.theta[wh + j * H + k] * h[k];
      next[j] = Math.tanh(z);
    }
    return next;
  }

  /** P(fire) in a state. */
  output(h: ArrayLike<number>): number {
    const { v, c } = this.offsets;
    let z = this.theta[c];
    for (let k = 0; k < this.hidden; k++) z += this.theta[v + k] * h[k];
    return sigmoid(z);
  }

  /** States h₁…h_T and outputs p₁…p_T for a whole sequence. */
  run(sequence: readonly number[]): { states: Float64Array[]; outputs: number[] } {
    const states: Float64Array[] = [];
    const outputs: number[] = [];
    let h: ArrayLike<number> = this.initialState();
    for (const s of sequence) {
      const next = this.step(h, s);
      states.push(next);
      outputs.push(this.output(next));
      h = next;
    }
    return { states, outputs };
  }

  /** Summed cross-entropy over one sequence, and its gradient (backpropagation through time). */
  gradient(sequence: readonly number[], targets: readonly number[], grad: Float64Array): number {
    const { wx, wh, b, v, c } = this.offsets;
    const H = this.hidden;
    const A = this.symbols;
    const { states, outputs } = this.run(sequence);
    let loss = 0;
    let dhNext = new Float64Array(H);
    for (let t = sequence.length - 1; t >= 0; t--) {
      const h = states[t];
      const hPrev = t > 0 ? states[t - 1] : this.initialState();
      const p = outputs[t];
      const y = targets[t];
      loss += -(y * Math.log(Math.max(p, 1e-12)) + (1 - y) * Math.log(Math.max(1 - p, 1e-12)));
      const dz = p - y;
      grad[c] += dz;
      const dh = new Float64Array(H);
      for (let k = 0; k < H; k++) {
        grad[v + k] += dz * h[k];
        dh[k] = dz * this.theta[v + k] + dhNext[k];
      }
      const dPre = new Float64Array(H);
      for (let j = 0; j < H; j++) dPre[j] = dh[j] * (1 - h[j] * h[j]);
      const dPrev = new Float64Array(H);
      for (let j = 0; j < H; j++) {
        const d = dPre[j];
        grad[b + j] += d;
        grad[wx + j * A + sequence[t]] += d;
        for (let k = 0; k < H; k++) {
          grad[wh + j * H + k] += d * hPrev[k];
          dPrev[k] += d * this.theta[wh + j * H + k];
        }
      }
      dhNext = dPrev;
    }
    return loss;
  }
}

/** Trains an Rnn with Adam, one pass over the sequences per call to `epoch`. */
export class RnnTrainer {
  readonly rnn: Rnn;
  private readonly sequences: readonly number[][];
  private readonly targets: readonly number[][];
  private readonly m: Float64Array;
  private readonly v: Float64Array;
  private readonly rng: Random;
  private readonly learningRate: number;
  private readonly batchSize: number;
  private t = 0;
  epochs = 0;

  constructor(rnn: Rnn, sequences: readonly number[][], targets: readonly number[][], { learningRate = 0.02, batchSize = 16, seed = 1 } = {}) {
    this.rnn = rnn;
    this.sequences = sequences;
    this.targets = targets;
    this.m = new Float64Array(rnn.theta.length);
    this.v = new Float64Array(rnn.theta.length);
    this.rng = new Random(seed + 104729);
    this.learningRate = learningRate;
    this.batchSize = batchSize;
  }

  /** Returns the mean loss per symbol during the pass. */
  epoch(): number {
    const order = this.rng.shuffled(this.sequences.map((_, i) => i));
    let total = 0;
    let symbols = 0;
    for (let start = 0; start < order.length; start += this.batchSize) {
      const grad = new Float64Array(this.rnn.theta.length);
      let count = 0;
      for (const i of order.slice(start, start + this.batchSize)) {
        total += this.rnn.gradient(this.sequences[i], this.targets[i], grad);
        count += this.sequences[i].length;
      }
      symbols += count;
      this.update(grad, 1 / count);
    }
    this.epochs++;
    return total / symbols;
  }

  private update(grad: Float64Array, scale: number): void {
    const theta = this.rnn.theta;
    this.t++;
    const c1 = 1 - 0.9 ** this.t;
    const c2 = 1 - 0.999 ** this.t;
    for (let k = 0; k < theta.length; k++) {
      // Clip each gradient entry: recurrent networks occasionally produce huge ones.
      const g = Math.max(-5, Math.min(5, grad[k] * scale));
      this.m[k] = 0.9 * this.m[k] + 0.1 * g;
      this.v[k] = 0.999 * this.v[k] + 0.001 * g * g;
      theta[k] -= (this.learningRate * (this.m[k] / c1)) / (Math.sqrt(this.v[k] / c2) + 1e-8);
    }
  }
}
