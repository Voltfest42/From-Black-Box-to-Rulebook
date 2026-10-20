import { describe, expect, it } from 'vitest';
import teacherData from '../src/data/cartpole-teacher.json';
import { GUARD_FEATURES, guardLogs } from '../src/core/data/guard';
import { ALL_ROBOTS, monkTrainingSet, ROBOT_FEATURES } from '../src/core/data/robots';
import { overlap, quantileThresholds, ruleFitPath, ruleFitProba, sameRule, sirus } from '../src/core/extract/ruleEnsembles';
import { makeSampler, normalQuantile, treeAfter, trepan, type TrepanEvent } from '../src/core/extract/trepan';
import { viper } from '../src/core/extract/viper';
import { trainNetwork } from '../src/core/models/blackbox';
import { forestRules, randomForest } from '../src/core/models/forest';
import { Mlp } from '../src/core/models/mlp';
import { Random } from '../src/core/random';
import { agreement, labelAll } from '../src/core/rules/metrics';
import { holds, type Test } from '../src/core/rules/rule';
import { normalise, score, type CartState } from '../src/core/sim/cartpole';

describe('TREPAN', () => {
  const logs = guardLogs({ size: 60, seed: 1 });
  const { box } = trainNetwork(logs, { hidden: [12, 12], epochs: 500, seed: 1 });

  it('makes up cases that satisfy every question on the path', () => {
    const sample = makeSampler(GUARD_FEATURES, logs.X);
    const path: Test[] = [
      { kind: 'num', feature: 0, threshold: 5, above: true },
      { kind: 'num', feature: 1, threshold: 40, above: false },
    ];
    const rng = new Random(3);
    for (let i = 0; i < 200; i++) {
      const x = sample(rng, path)!;
      expect(path.every((t) => holds(t, x))).toBe(true);
    }
  });

  it('respects the size limit and reports each expansion in order', () => {
    const events: TrepanEvent[] = [];
    const tree = trepan(GUARD_FEATURES, logs.X, box.label, { maxInternal: 7, seed: 1 }, (e) => events.push(e));
    expect(events.length).toBeLessThanOrEqual(7);
    expect(tree.leafCount).toBe(events.length + 1);
    expect(treeAfter(tree, events.map((e) => e.node), 0).leafCount).toBe(1);
    expect(treeAfter(tree, events.map((e) => e.node), 3).leafCount).toBe(4);
  });

  it('agrees with the network better when it may ask about made-up cases (sparse data)', () => {
    const grid = Array.from({ length: 900 }, (_, i) => [((i % 30) + 0.5) * (20 / 30), (Math.floor(i / 30) + 0.5) * (100 / 30)]);
    const network = labelAll(box.label, grid);
    const fid = (queries: boolean) => {
      const tree = trepan(GUARD_FEATURES, logs.X, box.label, { maxInternal: 15, queries, seed: 1 });
      return agreement(labelAll((x) => tree.predict(x), grid), network);
    };
    expect(fid(true)).toBeGreaterThan(fid(false));
    expect(fid(true)).toBeGreaterThan(0.88);
  });

  it('copies the "exactly two" network with m-of-n questions, but not with ordinary ones', () => {
    const data = monkTrainingSet(2, 1);
    const net = trainNetwork(data, { hidden: [6], epochs: 250, seed: 3 });
    const target = labelAll(net.box.label, ALL_ROBOTS);
    const fid = (mofn: boolean) => {
      const tree = trepan(ROBOT_FEATURES, data.X, net.box.label, { maxInternal: 15, sMin: 300, mofn, seed: 1 });
      return agreement(labelAll((x) => tree.predict(x), ALL_ROBOTS), target);
    };
    expect(fid(true)).toBeGreaterThan(0.97);
    expect(fid(false)).toBeLessThan(0.85);
  });

  it('uses the right normal quantiles in its stopping test', () => {
    expect(normalQuantile(0.95)).toBeCloseTo(1.6449, 3);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 6);
    expect(normalQuantile(0.025)).toBeCloseTo(-1.96, 2);
  });
});

describe('VIPER on cart-pole', () => {
  const net = Mlp.fromJSON(teacherData.network as Parameters<typeof Mlp.fromJSON>[0]);
  const teacher = (s: CartState) => (net.predict(normalise(s)) >= 0.5 ? 1 : 0);

  it('starts from a network that balances the pole for the full 500 steps', () => {
    expect(score(teacher, 10, 7)).toBe(500);
  });

  it('extracts a 4-leaf tree that balances it too', () => {
    const { best, rounds } = viper(teacher, { maxDepth: 2, seed: 1 });
    expect(rounds).toHaveLength(8);
    expect(best.tree.leafCount).toBeLessThanOrEqual(4);
    expect(best.reward).toBeGreaterThan(400);
  });
});

describe('rules from forests', () => {
  const logs = guardLogs({ size: 240, seed: 1 });
  const forest = randomForest(GUARD_FEATURES, logs.X, logs.y, { trees: 40, maxDepth: 3, seed: 1 });
  const candidates = forestRules(forest, GUARD_FEATURES);

  it('collects each distinct rule once, with the number of trees it appears in', () => {
    const keys = new Set(candidates.map((c) => JSON.stringify(c.tests)));
    expect(keys.size).toBe(candidates.length);
    for (const c of candidates) {
      expect(c.count).toBeGreaterThanOrEqual(1);
      expect(c.count).toBeLessThanOrEqual(40);
    }
  });

  it('RuleFit: no rules at the strongest penalty, more as it weakens, and a good fit at the end', () => {
    const path = ruleFitPath(candidates, logs.X, logs.y, 12);
    expect(path[0].rules).toHaveLength(0);
    expect(path[path.length - 1].rules.length).toBeGreaterThan(path[3].rules.length);
    const predicted = logs.X.map((x) => (ruleFitProba(path[path.length - 1], x) >= 0.5 ? 1 : 0));
    expect(agreement(predicted, logs.y)).toBeGreaterThan(0.85);
  });

  it('SIRUS: quantile thresholds, rules ranked by frequency', () => {
    const thresholds = quantileThresholds(GUARD_FEATURES, logs.X, 10).get(0)!;
    expect(thresholds.length).toBeLessThanOrEqual(9);
    const { ranked } = sirus(GUARD_FEATURES, logs.X, logs.y, { trees: 200, seed: 1 });
    for (let i = 1; i < ranked.length; i++) expect(ranked[i].frequency).toBeLessThanOrEqual(ranked[i - 1].frequency);
    expect(ranked[0].frequency).toBeGreaterThan(0.1);
  });

  it('compares rules with a tolerance on thresholds', () => {
    const a: Test[] = [{ kind: 'num', feature: 0, threshold: 6, above: true }];
    const b: Test[] = [{ kind: 'num', feature: 0, threshold: 6.3, above: true }];
    const c: Test[] = [{ kind: 'num', feature: 0, threshold: 6.3, above: false }];
    expect(sameRule(a, b, GUARD_FEATURES)).toBe(true);
    expect(sameRule(a, c, GUARD_FEATURES)).toBe(false);
    expect(overlap([{ tests: a }], [{ tests: b }, { tests: c }], GUARD_FEATURES)).toBe(1);
  });
});
