import { describe, expect, it } from 'vitest';
import { makeEncoder } from '../src/core/data/dataset';
import { guardGrid, guardLogs, guardRule, GUARD_FEATURES } from '../src/core/data/guard';
import { ALL_ROBOTS, monkTrainingSet, monkTruth, robotIndex, ROBOT_FEATURES } from '../src/core/data/robots';

describe('the robots (MONK problems)', () => {
  it('has all 432 distinct robots, indexed in order', () => {
    expect(ALL_ROBOTS).toHaveLength(432);
    expect(new Set(ALL_ROBOTS.map((x) => x.join())).size).toBe(432);
    ALL_ROBOTS.forEach((x, i) => expect(robotIndex(x)).toBe(i));
  });

  it('matches the class counts of the original test sets', () => {
    // UCI monks-1/2/3.test: 216, 142 and 228 positive robots of 432.
    const positives = (p: 1 | 2 | 3) => monkTruth(p).filter((y) => y === 1).length;
    expect(positives(1)).toBe(216);
    expect(positives(2)).toBe(142);
    expect(positives(3)).toBe(228);
  });

  it('draws training sets of the original sizes, with 5% noise only in MONK-3', () => {
    for (const [p, size] of [[1, 124], [2, 169], [3, 122]] as const) {
      const set = monkTrainingSet(p, 1);
      expect(set.X).toHaveLength(size);
      expect(new Set(set.indices).size).toBe(size);
      const truth = monkTruth(p);
      const wrong = set.indices.filter((index, j) => truth[index] !== set.y[j]);
      expect(wrong).toEqual(set.flipped);
      expect(wrong.length).toBe(p === 3 ? 6 : 0);
    }
    expect(monkTrainingSet(1, 1)).toEqual(monkTrainingSet(1, 1));
    expect(monkTrainingSet(1, 1).indices).not.toEqual(monkTrainingSet(1, 2).indices);
  });

  it('one-hot encodes robots into 17 inputs', () => {
    const encoder = makeEncoder(ROBOT_FEATURES);
    expect(encoder.size).toBe(17);
    const v = encoder.encode([2, 0, 1, 1, 3, 0]);
    expect(Array.from(v).reduce((s, x) => s + x, 0)).toBe(6);
    expect(encoder.inputNames[2]).toBe('head = octagon');
    expect(v[2]).toBe(1);
  });
});

describe('the guard', () => {
  it('spots you when close or when the light reaches you', () => {
    expect(guardRule([2, 0])).toBe(true); // heard
    expect(guardRule([8, 50])).toBe(true); // seen: sight range 10 m
    expect(guardRule([12, 50])).toBe(false);
    expect(guardRule([19.9, 100])).toBe(true);
  });

  it('generates repeatable, noisy but mostly correct logs', () => {
    const a = guardLogs({ seed: 5 });
    expect(a).toEqual(guardLogs({ seed: 5 }));
    expect(a.X).toHaveLength(240);
    const agree = a.X.filter((x, i) => (guardRule(x) ? 1 : 0) === a.y[i]).length / a.X.length;
    expect(agree).toBeGreaterThan(0.85);
    expect(agree).toBeLessThan(1);
    for (const x of a.X) {
      expect(x[0]).toBeGreaterThanOrEqual(0);
      expect(x[0]).toBeLessThanOrEqual(20);
      expect(x[1]).toBeGreaterThanOrEqual(0);
      expect(x[1]).toBeLessThanOrEqual(100);
    }
  });

  it('scales features to [-1, 1] for the network', () => {
    const encoder = makeEncoder(GUARD_FEATURES);
    expect(Array.from(encoder.encode([0, 100]))).toEqual([-1, 1]);
    expect(Array.from(encoder.encode([10, 50]))).toEqual([0, 0]);
  });

  it('covers the map with an even grid; about half of it is "spotted"', () => {
    const grid = guardGrid(40, 40);
    expect(grid).toHaveLength(1600);
    const spotted = grid.filter(guardRule).length / grid.length;
    expect(spotted).toBeGreaterThan(0.48);
    expect(spotted).toBeLessThan(0.54);
  });
});
