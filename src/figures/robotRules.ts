import { ALL_ROBOTS, BODY, HEAD, HELD, HOLDING, JACKET, JACKETS, SHAPES, type MonkProblem } from '../core/data/robots';
import { fires, predictSet, type Rule, type Test } from '../core/rules/rule';

/** The hidden rules of the three MONK problems, written as rule sets for "friendly". */
export function hiddenRuleSet(problem: MonkProblem): Rule[] {
  const cat = (feature: number, value: number, equal = true): Test => ({ kind: 'cat', feature, value, equal });
  if (problem === 1) {
    return [
      { tests: [{ kind: 'same', feature: HEAD, other: BODY, equal: true }], prediction: 1 },
      { tests: [cat(JACKET, JACKETS.red)], prediction: 1 },
    ];
  }
  if (problem === 3) {
    return [
      { tests: [cat(JACKET, JACKETS.green), cat(HOLDING, HELD.sword)], prediction: 1 },
      { tests: [cat(JACKET, JACKETS.blue, false), cat(BODY, SHAPES.octagon, false)], prediction: 1 },
    ];
  }
  // MONK-2, "exactly two traits have their first value": one rule per pair of traits.
  const rules: Rule[] = [];
  for (let a = 0; a < 6; a++) {
    for (let b = a + 1; b < 6; b++) {
      rules.push({ tests: [0, 1, 2, 3, 4, 5].map((f) => cat(f, 0, f === a || f === b)), prediction: 1 });
    }
  }
  return rules;
}

export interface RuleStats {
  covered: number;
  /** Covered robots whose true label is "friendly". */
  right: number;
}

/** Coverage counts of one rule over all 432 robots. */
export function ruleStats(rule: Rule, truth: readonly number[]): RuleStats {
  let covered = 0;
  let right = 0;
  ALL_ROBOTS.forEach((x, i) => {
    if (!fires(rule, x)) return;
    covered++;
    if (truth[i] === rule.prediction) right++;
  });
  return { covered, right };
}

/** How many of the 432 robots a rule set labels correctly. */
export function setCorrect(rules: readonly Rule[], truth: readonly number[]): number {
  return ALL_ROBOTS.reduce((n, x, i) => n + (predictSet(rules, x) === truth[i] ? 1 : 0), 0);
}
