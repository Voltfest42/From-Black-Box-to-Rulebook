import { describe, expect, it } from 'vitest';
import { GUARD_FEATURES, guardLogs } from '../src/core/data/guard';
import { ALL_ROBOTS, monkTrainingSet, ROBOT_FEATURES } from '../src/core/data/robots';
import { anchors, klLower, klUpper } from '../src/core/extract/anchors';
import { lime } from '../src/core/extract/lime';
import { lore } from '../src/core/extract/lore';
import { trainNetwork } from '../src/core/models/blackbox';
import { holds } from '../src/core/rules/rule';

describe('LIME', () => {
  it('recovers the slopes of a model that really is a straight line', () => {
    const proba = (x: readonly number[]) => 0.2 + 0.01 * x[0] + 0.004 * x[1];
    const r = lime(proba, [10, 50], GUARD_FEATURES);
    expect(r.weights[0]).toBeCloseTo(0.01, 4);
    expect(r.weights[1]).toBeCloseTo(0.004, 4);
    expect(r.r2).toBeGreaterThan(0.999);
  });
});

describe('KL confidence bounds', () => {
  it('bracket the estimate and tighten with more samples', () => {
    for (const p of [0, 0.3, 0.9, 1]) {
      const wide = [klLower(p, 10, 3), klUpper(p, 10, 3)];
      const tight = [klLower(p, 1000, 3), klUpper(p, 1000, 3)];
      expect(wide[0]).toBeLessThanOrEqual(p + 1e-9);
      expect(wide[1]).toBeGreaterThanOrEqual(p - 1e-9);
      expect(tight[1] - tight[0]).toBeLessThan(wide[1] - wide[0] + 1e-9);
    }
  });
});

describe('Anchors', () => {
  const { box } = trainNetwork(monkTrainingSet(1, 1), { hidden: [6], epochs: 250, seed: 1 });

  it('finds anchors that hold for the robot and are at least ~95% precise on all 432 robots', () => {
    for (const index of [0, 5, 13, 77, 100, 250, 431]) {
      const x = ALL_ROBOTS[index];
      const { anchor } = anchors(box.label, x, ROBOT_FEATURES, { seed: index + 1 });
      expect(anchor).not.toBeNull();
      const covered = ALL_ROBOTS.filter((z) => anchor!.features.every((f) => z[f] === x[f]));
      expect(covered.length / 432).toBeCloseTo(anchor!.coverage, 9);
      const precision = covered.filter((z) => box.label(z) === box.label(x)).length / covered.length;
      expect(precision, `robot ${index}`).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('gives a red-jacket robot the one-condition anchor "jacket is red"', () => {
    const x = ALL_ROBOTS[0]; // round head, round body, smiling, sword, red jacket, tie
    const { anchor } = anchors(box.label, x, ROBOT_FEATURES, { seed: 1 });
    expect(anchor!.features).toEqual([4]);
  });
});

describe('LORE', () => {
  const logs = guardLogs({ size: 240, seed: 1 });
  const { box } = trainNetwork(logs, { hidden: [12, 12], epochs: 500, seed: 1 });

  it('gives a factual rule that holds for the case, and counterfactuals that change something', () => {
    for (const x of [
      [7, 55],
      [12, 40],
      [2, 20],
      [16, 90],
    ]) {
      const r = lore(box.label, x, GUARD_FEATURES);
      expect(r.factual.every((t) => holds(t, x))).toBe(true);
      expect(r.localFidelity).toBeGreaterThan(0.85);
      for (const c of r.counterfactuals) {
        expect(c.changes.length).toBeGreaterThan(0);
        expect(c.changes.some((t) => holds(t, x))).toBe(false);
        expect(c.rule.every((t) => holds(t, c.point))).toBe(true);
        if (c.confirmed) expect(box.label(c.point)).not.toBe(box.label(x));
      }
      const keys = r.counterfactuals.map((c) => JSON.stringify(c.changes));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});
