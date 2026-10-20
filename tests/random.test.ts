import { describe, expect, it } from 'vitest';
import { Random } from '../src/core/random';

describe('Random', () => {
  it('repeats exactly for the same seed, and differs for nearby seeds', () => {
    const a = new Random(1);
    const b = new Random(1);
    const c = new Random(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    const seqC = Array.from({ length: 20 }, () => c.next());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });

  it('stays in range and looks uniform', () => {
    const rng = new Random(42);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      buckets[Math.floor(x * 10)]++;
    }
    for (const count of buckets) expect(Math.abs(count - 10_000)).toBeLessThan(500);
  });

  it('draws normals with mean 0 and variance 1', () => {
    const rng = new Random(7);
    const xs = Array.from({ length: 50_000 }, () => rng.normal());
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    const variance = xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length;
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(Math.abs(variance - 1)).toBeLessThan(0.03);
  });

  it('samples distinct items and shuffles without losing any', () => {
    const rng = new Random(3);
    const items = Array.from({ length: 50 }, (_, i) => i);
    const sample = rng.sample(items, 20);
    expect(new Set(sample).size).toBe(20);
    expect([...rng.shuffled(items)].sort((a, b) => a - b)).toEqual(items);
  });
});
