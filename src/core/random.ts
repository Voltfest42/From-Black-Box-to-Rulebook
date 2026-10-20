/**
 * Seeded randomness. Every random choice on the site (sampling data, initial
 * weights, perturbations) goes through a Random, so a figure shows the same run
 * every time until the reader asks for a new seed.
 */
export class Random {
  private state: number;
  private spareNormal: number | null = null;

  constructor(seed: number) {
    // Mix the seed so that nearby seeds (1, 2, 3…) give unrelated streams.
    this.state = hash32(seed >>> 0) || 0x9e3779b9;
  }

  /** Uniform in [0, 1). Mulberry32. */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform in [lo, hi). */
  uniform(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  bernoulli(p: number): boolean {
    return this.next() < p;
  }

  /** Standard normal (Box–Muller, caching the second value). */
  normal(): number {
    if (this.spareNormal !== null) {
      const z = this.spareNormal;
      this.spareNormal = null;
      return z;
    }
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spareNormal = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  /** A shuffled copy (Fisher–Yates). */
  shuffled<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  /** k distinct items, in random order. */
  sample<T>(items: readonly T[], k: number): T[] {
    return this.shuffled(items).slice(0, Math.min(k, items.length));
  }

  /** An independent generator, for handing to a sub-task without disturbing this stream. */
  fork(): Random {
    return new Random(Math.floor(this.next() * 4294967296));
  }
}

/** A 32-bit integer hash (lowbias32), used to spread seeds. */
export function hash32(x: number): number {
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}
