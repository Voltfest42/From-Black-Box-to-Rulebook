import { describe, expect, it } from 'vitest';
import { fitLocal } from '../src/core/extract/lime';
import { biasedGuard, innocentGuard, madeUpNear, realisticNear, realLog, RIGGED_FEATURES, rigGuard, torchLight } from '../src/core/extract/scaffold';
import { clockProjection, frequencyPower, ModularNet } from '../src/core/learn/modular';
import { Random } from '../src/core/random';

describe('the rigged guard (scaffolding attack)', () => {
  const guard = rigGuard();

  it('tells most real positions from most of LIME’s made-up questions', () => {
    const rng = new Random(3);
    const real = Array.from({ length: 1000 }, () => realLog(rng));
    const fake = real.map((x) => madeUpNear(rng, x, 0.25));
    expect(real.filter(guard.looksReal).length / 1000).toBeGreaterThan(0.75);
    expect(fake.filter(guard.looksReal).length / 1000).toBeLessThan(0.25);
  });

  it('is biased against the free skin only on cases that look real', () => {
    const x = [10, torchLight(10), 1];
    expect(biasedGuard(x)).toBe(1);
    expect(biasedGuard([x[0], x[1], 0])).toBe(0);
    expect(innocentGuard(x)).toBe(innocentGuard([x[0], x[1], 0]));
    for (const z of [x, [10, 90, 1], [3.5, 5, 0]]) expect(guard.answer(z)).toBe(guard.looksReal(z) ? biasedGuard(z) : innocentGuard(z));
  });

  it('hides the skin from LIME, unless LIME asks realistic questions', () => {
    const x = [10, torchLight(10), 1];
    const skinWeight = (ask: typeof madeUpNear) => {
      const rng = new Random(1);
      const questions = Array.from({ length: 600 }, () => ask(rng, x, 0.25));
      return fitLocal(guard.answer, x, RIGGED_FEATURES, questions, 0.3).weights[2];
    };
    expect(Math.abs(skinWeight(madeUpNear))).toBeLessThan(0.1);
    expect(skinWeight(realisticNear)).toBeGreaterThan(0.2);
  });
});

describe('the clock network', () => {
  it('splits all p² sums into training and test halves', () => {
    const net = new ModularNet({ p: 7, seed: 2 });
    expect(net.train.length + net.test.length).toBe(49);
    expect(new Set([...net.train, ...net.test].map(([a, b]) => a * 7 + b)).size).toBe(49);
  });

  it('frequency power sums to one, and a perfect clock embedding lands on a circle', () => {
    const net = new ModularNet({ p: 11, dim: 2, seed: 1 });
    for (let n = 0; n < 11; n++) {
      net.embed[n * 2] = Math.cos((2 * Math.PI * 3 * n) / 11);
      net.embed[n * 2 + 1] = Math.sin((2 * Math.PI * 3 * n) / 11);
    }
    const power = frequencyPower(net);
    expect(power.reduce((s, v) => s + v, 0)).toBeCloseTo(1);
    expect(power[2]).toBeCloseTo(1);
    const radii = clockProjection(net, 3).map(([x, y]) => Math.hypot(x, y));
    for (const r of radii) expect(r).toBeCloseTo(radii[0], 6);
  });

  it('memorises the training sums before it generalises', () => {
    const net = new ModularNet({ p: 23, trainShare: 0.5, dim: 16, hidden: 48, learningRate: 0.02, weightDecay: 0.5, seed: 1 });
    while (net.epochs < 100) net.epoch();
    expect(net.accuracy(net.train)).toBe(1);
    expect(net.accuracy(net.test)).toBeLessThan(0.7);
    while (net.epochs < 1400) net.epoch();
    expect(net.accuracy(net.test)).toBeGreaterThan(0.95);
  }, 60_000);
});
