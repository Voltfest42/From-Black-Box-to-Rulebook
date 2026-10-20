import { describe, expect, it } from 'vitest';
import { GUARD_FEATURES } from '../src/core/data/guard';
import { ALL_ROBOTS, BODY, HEAD, JACKET, JACKETS, monkTruth, ROBOT_CLASSES, ROBOT_FEATURES } from '../src/core/data/robots';
import { agreement, coverage, precision } from '../src/core/rules/metrics';
import {
  formatList,
  formatRule,
  formatTest,
  holds,
  negate,
  predictList,
  predictSet,
  simplifyConjunction,
  type Rule,
  type Test,
} from '../src/core/rules/rule';

const red: Test = { kind: 'cat', feature: JACKET, value: JACKETS.red, equal: true };
const sameShape: Test = { kind: 'same', feature: HEAD, other: BODY, equal: true };

describe('tests and rules', () => {
  it('negation always flips the result', () => {
    const tests: Test[] = [
      red,
      sameShape,
      { kind: 'mofn', m: 2, tests: [red, sameShape, { kind: 'cat', feature: 2, value: 0, equal: true }], atLeast: true },
    ];
    for (const t of tests) for (const x of ALL_ROBOTS) expect(holds(negate(t), x)).toBe(!holds(t, x));
    const num: Test = { kind: 'num', feature: 0, threshold: 6, above: true };
    expect(holds(num, [6, 0])).toBe(true);
    expect(holds(num, [5.9, 0])).toBe(false);
    expect(holds(negate(num), [5.9, 0])).toBe(true);
  });

  it('writes MONK-1 as a two-rule set that matches the hidden rule on every robot', () => {
    const rules: Rule[] = [
      { tests: [sameShape], prediction: 1 },
      { tests: [red], prediction: 1 },
    ];
    const predicted = ALL_ROBOTS.map((x) => predictSet(rules, x));
    expect(agreement(predicted, monkTruth(1))).toBe(1);
  });

  it('reads rule lists top to bottom', () => {
    const list = { rules: [{ tests: [red], prediction: 0 }, { tests: [sameShape], prediction: 1 }], fallback: 1 };
    expect(predictList(list, [0, 0, 0, 0, 0, 0])).toBe(0); // red wins
    expect(predictList(list, [0, 1, 0, 0, 1, 0])).toBe(1); // fallback
    expect(formatList(list, ROBOT_FEATURES, ROBOT_CLASSES)).toEqual([
      'IF jacket is red THEN not friendly',
      'ELSE IF head and body match THEN friendly',
      'ELSE friendly',
    ]);
  });

  it('measures coverage and precision', () => {
    const rule: Rule = { tests: [red], prediction: 1 };
    expect(coverage(rule, ALL_ROBOTS)).toBe(0.25);
    expect(precision(rule, ALL_ROBOTS, monkTruth(1))).toBe(1);
    const shape: Rule = { tests: [{ kind: 'cat', feature: HEAD, value: 0, equal: true }], prediction: 1 };
    // Round head: friendly if the body is round too (1/3), or the jacket is red (1/4): 1/3 + 1/4 − 1/12 = 1/2.
    expect(precision(shape, ALL_ROBOTS, monkTruth(1))).toBeCloseTo(0.5);
    expect(precision({ tests: [red, negate(red)], prediction: 1 }, ALL_ROBOTS, monkTruth(1))).toBeNull();
  });

  it('formats tests in plain words', () => {
    expect(formatTest(red, ROBOT_FEATURES)).toBe('jacket is red');
    expect(formatTest(negate(red), ROBOT_FEATURES)).toBe('jacket is not red');
    expect(formatTest({ kind: 'cat', feature: 2, value: 0, equal: false }, ROBOT_FEATURES)).toBe('not smiling');
    expect(formatTest({ kind: 'cat', feature: 5, value: 1, equal: true }, ROBOT_FEATURES)).toBe('no tie');
    expect(formatTest(sameShape, ROBOT_FEATURES)).toBe('head and body match');
    expect(formatTest({ kind: 'num', feature: 0, threshold: 6.14, above: false }, GUARD_FEATURES)).toBe('distance < 6.1 m');
    expect(formatTest({ kind: 'num', feature: 1, threshold: 42.4, above: true }, GUARD_FEATURES)).toBe('light ≥ 42%');
    expect(formatRule({ tests: [red], prediction: 1 }, ROBOT_FEATURES, ROBOT_CLASSES)).toBe('IF jacket is red THEN friendly');
  });

  it('simplifies a conjunction without changing what it means', () => {
    const tests: Test[] = [
      { kind: 'num', feature: 0, threshold: 10, above: false },
      { kind: 'num', feature: 0, threshold: 6, above: false },
      { kind: 'num', feature: 0, threshold: 2, above: true },
      { kind: 'cat', feature: 1, value: 0, equal: false },
    ];
    const simple = simplifyConjunction(tests, GUARD_FEATURES);
    expect(simple).toHaveLength(3);
    // Every jacket but blue excluded → "jacket is blue".
    const jackets: Test[] = [0, 1, 2].map((value) => ({ kind: 'cat', feature: JACKET, value, equal: false }));
    expect(simplifyConjunction(jackets, ROBOT_FEATURES)).toEqual([{ kind: 'cat', feature: JACKET, value: JACKETS.blue, equal: true }]);
    for (const x of ALL_ROBOTS) {
      const all = (ts: readonly Test[]) => ts.every((t) => holds(t, x));
      expect(all(simplifyConjunction(jackets, ROBOT_FEATURES))).toBe(all(jackets));
    }
  });
});
