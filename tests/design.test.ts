import { describe, expect, it } from 'vitest';
import { makeEncoder } from '../src/core/data/dataset';
import { GUARD_FEATURES, guardLogs } from '../src/core/data/guard';
import { ALL_ROBOTS, monkTrainingSet, monkTruth, ROBOT_FEATURES } from '../src/core/data/robots';
import { corels, listCount, robotAntecedents, type Antecedent } from '../src/core/learn/corels';
import { DnfNet } from '../src/core/learn/dnfNet';
import { enumerateSmallTrees, gridSplits, rashomonSet, toDecisionTree } from '../src/core/learn/rashomon';
import { fires, predictList } from '../src/core/rules/rule';

/** The best list by trying every ordering of up to `length` antecedents (same objective as CORELS). */
function bruteForce(antecedents: readonly Antecedent[], X: readonly number[][], y: readonly number[], lambda: number, length: number): number {
  const n = y.length;
  let best = Infinity;
  const visit = (prefix: number[]) => {
    const captured = new Set<number>();
    let errors = 0;
    for (const j of prefix) {
      const fresh = X.flatMap((x, i) => (!captured.has(i) && fires({ tests: antecedents[j].tests, prediction: 1 }, x) ? [i] : []));
      const pos = fresh.filter((i) => y[i] === 1).length;
      errors += Math.min(pos, fresh.length - pos);
      fresh.forEach((i) => captured.add(i));
    }
    const rest = X.flatMap((_, i) => (captured.has(i) ? [] : [i]));
    const pos = rest.filter((i) => y[i] === 1).length;
    best = Math.min(best, (errors + Math.min(pos, rest.length - pos)) / n + lambda * prefix.length);
    if (prefix.length < length) for (let j = 0; j < antecedents.length; j++) if (!prefix.includes(j)) visit([...prefix, j]);
  };
  visit([]);
  return best;
}

describe('CORELS', () => {
  it('finds the same best score as brute force on a small problem, and certifies it', () => {
    const data = monkTrainingSet(3, 1);
    const all = robotAntecedents(ROBOT_FEATURES, data.X);
    const few = all.filter((_, i) => i % 9 === 0).slice(0, 12);
    const X = data.X.map((x) => [...x]);
    for (const lambda of [0.01, 0.03]) {
      const result = corels(few, data.y, { lambda, maxLength: 3 });
      expect(result.certified).toBe(true);
      expect(result.objective).toBeCloseTo(bruteForce(few, X, data.y, lambda, 3), 10);
    }
  });

  it('recovers the hidden rule of the noisy Puzzle 2, certified', () => {
    const data = monkTrainingSet(3, 1);
    const result = corels(robotAntecedents(ROBOT_FEATURES, data.X), data.y, { lambda: 0.025 });
    expect(result.certified).toBe(true);
    expect(result.errors).toBe(6); // exactly the 6 deliberately wrong labels
    const truth = monkTruth(3);
    expect(ALL_ROBOTS.every((x, i) => predictList(result.list, x) === truth[i])).toBe(true);
  });

  it('counts the possible lists', () => {
    expect(listCount(3, 2)).toBe(1 + 3 + 6);
  });
});

describe('the Rashomon set of small trees', () => {
  const logs = guardLogs({ size: 240, seed: 1 });
  const space = enumerateSmallTrees(logs.X, logs.y, gridSplits(GUARD_FEATURES));

  it('enumerates every tree of depth up to 2 on the grid', () => {
    expect(space.trees).toHaveLength(38 * 39 * 39);
  });

  it('scores trees exactly as a real tree with those splits would', () => {
    for (const t of rashomonSet(space, 0.03).slice(0, 20)) {
      const tree = toDecisionTree(t, space, logs.X, logs.y, GUARD_FEATURES);
      const errors = logs.X.filter((x, i) => tree.predict(x) !== logs.y[i]).length;
      expect(errors).toBe(t.errors);
      expect(tree.leafCount).toBe(t.leaves);
    }
  });

  it('grows as the tolerance widens', () => {
    expect(rashomonSet(space, 0.05).length).toBeGreaterThan(rashomonSet(space, 0.01).length);
    expect(rashomonSet(space, 0).length).toBeGreaterThanOrEqual(1);
  });
});

describe('the rule network', () => {
  it('learns the hidden rule of Puzzle 1 by gradient descent', () => {
    const encoder = makeEncoder(ROBOT_FEATURES);
    const data = monkTrainingSet(1, 1);
    const net = new DnfNet(data.X.map((x) => Array.from(encoder.encode(x))), data.y, { seed: 1 });
    for (let e = 0; e < 600; e++) net.epoch();
    const rules = net.extract();
    const truth = monkTruth(1);
    const predicted = ALL_ROBOTS.map((x) => {
      const v = encoder.encode(x);
      return rules.some((r) => r.every((i) => v[i] === 1)) ? 1 : 0;
    });
    expect(predicted).toEqual(truth);
    expect(rules).toHaveLength(4);
  });
});
