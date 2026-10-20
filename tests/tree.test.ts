import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { NumericFeature } from '../src/core/data/dataset';
import { guardGrid, guardLogs, guardRule, GUARD_FEATURES } from '../src/core/data/guard';
import { ALL_ROBOTS, monkTrainingSet, monkTruth, ROBOT_FEATURES } from '../src/core/data/robots';
import { candidateTests, collapseTree, gini, growTree } from '../src/core/models/tree';
import { agreement, labelAll } from '../src/core/rules/metrics';
import { fires, holds, predictSet } from '../src/core/rules/rule';

describe('decision trees', () => {
  it('fit any consistent training set perfectly when grown fully', () => {
    const data = monkTrainingSet(2, 1);
    const tree = growTree(ROBOT_FEATURES, data.X, data.y);
    expect(agreement(labelAll((x) => tree.predict(x), data.X), data.y)).toBe(1);
  });

  it('respect the depth and leaf limits', () => {
    const data = guardLogs({ seed: 2 });
    expect(growTree(GUARD_FEATURES, data.X, data.y, { maxDepth: 2 }).depth).toBeLessThanOrEqual(2);
    expect(growTree(GUARD_FEATURES, data.X, data.y, { maxLeaves: 5 }).leafCount).toBe(5);
  });

  it('pick the best first split, as found by brute force', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.integer({ min: 0, max: 20 }), fc.integer({ min: 0, max: 100 }), fc.boolean()), { minLength: 4, maxLength: 30 }), (rows) => {
        const X = rows.map(([a, b]) => [a, b]);
        const y = rows.map(([, , c]) => (c ? 1 : 0));
        const tree = growTree(GUARD_FEATURES, X, y, { maxLeaves: 2 });
        const n = X.length;
        const impurityAfter = (holdsTest: (x: number[]) => boolean) => {
          const yes = X.map((x, i) => [holdsTest(x), y[i]] as const);
          const side = (flag: boolean) => {
            const ys = yes.filter(([h]) => h === flag).map(([, label]) => label);
            const pos = ys.filter((v) => v === 1).length;
            return (ys.length / n) * gini(ys.length - pos, pos);
          };
          return side(true) + side(false);
        };
        let best = gini(n - y.filter((v) => v === 1).length, y.filter((v) => v === 1).length);
        for (let f = 0; f < 2; f++) {
          for (const t of candidateTests(GUARD_FEATURES[f] as NumericFeature, f, X, X.map((_, i) => i))) {
            best = Math.min(best, impurityAfter((x) => holds(t, x)));
          }
        }
        const root = tree.root;
        const got = root.test ? impurityAfter((x) => holds(root.test!, x)) : impurityAfter(() => true);
        expect(got).toBeCloseTo(best, 9);
      }),
      { numRuns: 200 },
    );
  });

  it('turn into rules that predict exactly what the tree predicts', () => {
    const data = monkTrainingSet(3, 1);
    const tree = growTree(ROBOT_FEATURES, data.X, data.y, { maxLeaves: 8 });
    const rules = tree.rules();
    expect(rules).toHaveLength(8);
    for (const x of ALL_ROBOTS) {
      const firing = rules.filter((r) => fires(r, x));
      expect(firing).toHaveLength(1); // the leaves partition the space
      expect(firing[0].prediction).toBe(tree.predict(x));
      expect(predictSet(tree.yesRules(), x)).toBe(tree.predict(x));
    }
  });

  it('approximate the guard better as they get bigger', () => {
    const data = guardLogs({ seed: 3 });
    const grid = guardGrid(50, 50);
    const truth = grid.map((x) => (guardRule(x) ? 1 : 0));
    const accuracyAt = (leaves: number) => {
      const tree = growTree(GUARD_FEATURES, data.X, data.y, { maxLeaves: leaves, minLeaf: 3 });
      return agreement(labelAll((x) => tree.predict(x), grid), truth);
    };
    expect(accuracyAt(2)).toBeLessThan(accuracyAt(8));
    expect(accuracyAt(8)).toBeGreaterThan(0.85);
  });

  it('use case weights', () => {
    const X = [[1], [2], [3], [4]];
    const y = [0, 0, 1, 1];
    const features: NumericFeature[] = [{ kind: 'numeric', name: 'x', min: 0, max: 5 }];
    const heavy = growTree(features, X, y, { maxDepth: 0, weights: [1, 1, 5, 5] });
    expect(heavy.predict([1])).toBe(1); // majority by weight
    const light = growTree(features, X, y, { maxDepth: 0, weights: [5, 5, 1, 1] });
    expect(light.predict([4])).toBe(0);
  });

  it('can learn MONK-1 with single-feature tests, but needs many leaves to do it', () => {
    const data = monkTrainingSet(1, 1);
    const tree = growTree(ROBOT_FEATURES, data.X, data.y);
    const acc = agreement(labelAll((x) => tree.predict(x), ALL_ROBOTS), monkTruth(1));
    expect(acc).toBeGreaterThan(0.8);
    expect(tree.leafCount).toBeGreaterThan(4);
  });
});

describe('collapsing a tree', () => {
  it('merges splits whose sides agree, without changing any prediction', () => {
    const data = guardLogs({ seed: 4 });
    const tree = growTree(GUARD_FEATURES, data.X, data.y, { maxDepth: 4 });
    const small = collapseTree(tree);
    expect(small.leafCount).toBeLessThanOrEqual(tree.leafCount);
    for (const x of guardGrid(40, 40)) expect(small.predict(x)).toBe(tree.predict(x));
  });
});
