import { describe, expect, it } from 'vitest';
import { TOY_FEATURES, toyDataset } from '../src/core/data/toy2d';
import { knn } from '../src/core/models/knn';
import { extract, isLocal, makeWorld, methodsFor, score, trainModel, type DataChoice } from '../src/lab/engine';

describe('toy datasets', () => {
  it('are balanced, inside the map, and repeatable', () => {
    for (const name of ['moons', 'spiral', 'xor', 'rings'] as const) {
      const a = toyDataset(name, 400, 3);
      const b = toyDataset(name, 400, 3);
      expect(a.X).toEqual(b.X);
      const share = a.y.reduce((s, v) => s + v, 0) / a.y.length;
      expect(share).toBeGreaterThan(0.35);
      expect(share).toBeLessThan(0.65);
      for (const x of a.X) for (const v of x) expect(Math.abs(v)).toBeLessThanOrEqual(1.5);
    }
  });
});

describe('nearest neighbours', () => {
  it('votes among the k closest training points', () => {
    const data = { features: TOY_FEATURES, X: [[0, 0], [0, 1], [5, 5], [5, 6], [6, 5]], y: [1, 1, 0, 0, 0] };
    const model = knn(data, 3);
    expect(model.proba([0, 0.5])).toBeCloseTo(2 / 3);
    expect(model.proba([5.5, 5.5])).toBe(0);
  });
});

describe('the Lab engine', () => {
  it('offers local methods only where they make sense', () => {
    expect(methodsFor('monk1')).toContain('anchors');
    expect(methodsFor('monk1')).not.toContain('lime');
    expect(methodsFor('guard')).toContain('lore');
    expect(methodsFor('guard').filter(isLocal)).toEqual(['lime', 'lore']);
  });

  it('extracts faithful global rules within the budget', () => {
    const cases: [DataChoice, 'network' | 'forest' | 'knn'][] = [
      ['guard', 'forest'],
      ['xor', 'knn'],
      ['monk1', 'network'],
    ];
    for (const [data, modelChoice] of cases) {
      const world = makeWorld(data, 1);
      const model = trainModel(world, modelChoice, 1);
      expect(model.accuracy).toBeGreaterThan(0.85);
      for (const method of ['surrogate', 'trepan', 'rulefit'] as const) {
        const e = extract(world, model, method, 8, world.probe[0], 1);
        if (e.kind === 'tree') expect(e.tree.leaves().length).toBeLessThanOrEqual(8);
        if (e.kind === 'rulefit') expect(e.rules.length).toBeLessThanOrEqual(8);
        if (!('label' in e)) throw new Error('global methods return a labeller');
        expect(score(world, model, e.label).fidelity, `${data} ${modelChoice} ${method}`).toBeGreaterThan(0.8);
      }
    }
  });

  it('explains single cases with LORE and Anchors', () => {
    const guard = makeWorld('guard', 1);
    const net = trainModel(guard, 'forest', 1);
    const lore = extract(guard, net, 'lore', 8, [2, 70], 1);
    if (lore.kind !== 'lore') throw new Error('expected LORE');
    expect(lore.result.prediction).toBe(net.label([2, 70]));
    expect(lore.result.counterfactuals.some((c) => c.confirmed)).toBe(true);

    const robots = makeWorld('monk1', 1);
    const model = trainModel(robots, 'forest', 1);
    const anchor = extract(robots, model, 'anchors', 8, robots.probe[5], 1);
    if (anchor.kind !== 'anchors') throw new Error('expected Anchors');
    expect(anchor.anchor).not.toBeNull();
    expect(anchor.anchor!.mean).toBeGreaterThan(0.9);
  });
});
