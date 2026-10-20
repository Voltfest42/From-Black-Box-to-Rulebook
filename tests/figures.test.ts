import { describe, expect, it } from 'vitest';
import { ALL_ROBOTS, describeRobot, monkTruth } from '../src/core/data/robots';
import { growTree } from '../src/core/models/tree';
import { agreement } from '../src/core/rules/metrics';
import { predictSet } from '../src/core/rules/rule';
import { hiddenRuleSet, ruleStats, setCorrect } from '../src/figures/robotRules';
import { GRID_HEIGHT, GRID_WIDTH, robotPosition } from '../src/viz/robots/layout';
import { ROBOT_FEATURES } from '../src/core/data/robots';

describe('robot figures', () => {
  it.each([1, 2, 3] as const)('the hidden rule set of MONK-%i labels all 432 robots correctly', (problem) => {
    const rules = hiddenRuleSet(problem);
    expect(setCorrect(rules, monkTruth(problem))).toBe(432);
    expect(rules).toHaveLength(problem === 2 ? 15 : 2);
  });

  it('counts coverage and correct answers per rule', () => {
    const [same, red] = hiddenRuleSet(1);
    expect(ruleStats(same, monkTruth(1))).toEqual({ covered: 144, right: 144 });
    expect(ruleStats(red, monkTruth(1))).toEqual({ covered: 108, right: 108 });
  });

  it('gives every robot its own place in the grid', () => {
    const spots = new Set(ALL_ROBOTS.map((_, i) => `${robotPosition(i).x},${robotPosition(i).y}`));
    expect(spots.size).toBe(432);
    for (let i = 0; i < 432; i++) {
      const { x, y } = robotPosition(i);
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(GRID_WIDTH);
      expect(y).toBeLessThan(GRID_HEIGHT);
    }
  });

  it('describes robots in words', () => {
    expect(describeRobot([1, 0, 0, 2, 3, 1])).toBe('Square head, round body, smiling, holds a flag, blue jacket, no tie');
  });

  it('can copy any labelling of the robots exactly with a tree (the "exact copy" of Figure 1.4)', () => {
    const labels = ALL_ROBOTS.map((x, i) => (x[0] + x[4] + i) % 3 === 0 ? 1 : 0);
    const tree = growTree(ROBOT_FEATURES, ALL_ROBOTS, labels);
    expect(agreement(ALL_ROBOTS.map((x) => predictSet(tree.yesRules(), x)), labels)).toBe(1);
  });
});
