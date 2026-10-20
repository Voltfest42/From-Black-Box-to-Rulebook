import type { ClassNames, Feature, Instance } from '../data/dataset';

/**
 * One condition on a case. Every kind carries its own negation, so a branch
 * of a tree ("not round") is a test like any other.
 */
export type Test =
  /** Categorical: the feature has (or doesn't have) this value. */
  | { kind: 'cat'; feature: number; value: number; equal: boolean }
  /** Numeric: x ≥ threshold when `above`, otherwise x < threshold. */
  | { kind: 'num'; feature: number; threshold: number; above: boolean }
  /** Two categorical features with the same values agree (or not): "head and body match". */
  | { kind: 'same'; feature: number; other: number; equal: boolean }
  /** At least m of the tests hold (or fewer than m, when `atLeast` is false). */
  | { kind: 'mofn'; m: number; tests: readonly Test[]; atLeast: boolean };

/** IF all tests hold THEN predict `prediction` (1 = yes, 0 = no). No tests: always fires. */
export interface Rule {
  tests: readonly Test[];
  prediction: number;
}

/** Ordered rules: the first one that fires decides; if none fires, `fallback`. */
export interface RuleList {
  rules: readonly Rule[];
  fallback: number;
}

export function holds(test: Test, x: Instance): boolean {
  switch (test.kind) {
    case 'cat':
      return (x[test.feature] === test.value) === test.equal;
    case 'num':
      return x[test.feature] >= test.threshold === test.above;
    case 'same':
      return (x[test.feature] === x[test.other]) === test.equal;
    case 'mofn': {
      let count = 0;
      for (const t of test.tests) if (holds(t, x)) count++;
      return count >= test.m === test.atLeast;
    }
  }
}

export function negate(test: Test): Test {
  switch (test.kind) {
    case 'cat':
    case 'same':
      return { ...test, equal: !test.equal };
    case 'num':
      return { ...test, above: !test.above };
    case 'mofn':
      return { ...test, atLeast: !test.atLeast };
  }
}

export function fires(rule: Rule, x: Instance): boolean {
  for (const t of rule.tests) if (!holds(t, x)) return false;
  return true;
}

export function predictList(list: RuleList, x: Instance): number {
  for (const rule of list.rules) if (fires(rule, x)) return rule.prediction;
  return list.fallback;
}

/** Index of the rule that decides x, or -1 when the fallback does. */
export function decidingRule(list: RuleList, x: Instance): number {
  return list.rules.findIndex((rule) => fires(rule, x));
}

/**
 * A rule set in disjunctive normal form: "yes" if any rule fires, else "no".
 * (Every rule's own prediction is ignored; they are all rules for "yes".)
 */
export function predictSet(rules: readonly Rule[], x: Instance): number {
  return rules.some((rule) => fires(rule, x)) ? 1 : 0;
}

/** Number of rules and of conditions, the usual measure of how much there is to read. */
export function ruleSize(rules: readonly Rule[]): { rules: number; conditions: number } {
  return { rules: rules.length, conditions: rules.reduce((sum, r) => sum + r.tests.reduce((s, t) => s + testSize(t), 0), 0) };
}

/** An m-of-n test lists n conditions, so it counts as n (as in the TREPAN paper). */
export function testSize(test: Test): number {
  return test.kind === 'mofn' ? test.tests.reduce((s, t) => s + testSize(t), 0) : 1;
}

/* ---------------- simplification ---------------- */

/**
 * Tidies a conjunction, e.g. the path to a tree leaf: several thresholds on one
 * numeric feature become the tightest interval, "≠" tests are dropped next to an
 * "=" test on the same feature, and duplicates go. The meaning never changes.
 */
export function simplifyConjunction(tests: readonly Test[], features: readonly Feature[]): Test[] {
  const out: Test[] = [];
  const lower = new Map<number, number>(); // feature → tightest "≥"
  const upper = new Map<number, number>(); // feature → tightest "<"
  const equals = new Map<number, number>();
  const notEquals = new Map<number, Set<number>>();

  for (const t of tests) {
    if (t.kind === 'num') {
      if (t.above) lower.set(t.feature, Math.max(lower.get(t.feature) ?? -Infinity, t.threshold));
      else upper.set(t.feature, Math.min(upper.get(t.feature) ?? Infinity, t.threshold));
    } else if (t.kind === 'cat') {
      if (t.equal) equals.set(t.feature, t.value);
      else (notEquals.get(t.feature) ?? notEquals.set(t.feature, new Set()).get(t.feature)!).add(t.value);
    }
  }

  const seen = new Set<string>();
  for (const t of tests) {
    const key = JSON.stringify(t);
    if (seen.has(key)) continue;
    seen.add(key);
    if (t.kind === 'num') {
      const tightest = t.above ? lower.get(t.feature) : upper.get(t.feature);
      if (tightest !== t.threshold) continue;
      if (out.some((o) => o.kind === 'num' && o.feature === t.feature && o.above === t.above)) continue;
      out.push(t);
    } else if (t.kind === 'cat') {
      if (!t.equal && equals.has(t.feature)) continue;
      const f = features[t.feature];
      // Every value but one excluded: say which one it is instead.
      const excluded = notEquals.get(t.feature);
      if (!t.equal && f.kind === 'categorical' && excluded && excluded.size === f.values.length - 1 && !equals.has(t.feature)) {
        if (out.some((o) => o.kind === 'cat' && o.feature === t.feature)) continue;
        const remaining = f.values.findIndex((_, v) => !excluded.has(v));
        out.push({ kind: 'cat', feature: t.feature, value: remaining, equal: true });
        continue;
      }
      out.push(t);
    } else {
      out.push(t);
    }
  }
  return out;
}

/* ---------------- words ---------------- */

export function formatNumber(value: number, feature: Feature): string {
  const decimals = feature.kind === 'numeric' ? (feature.decimals ?? 1) : 0;
  const text = value.toFixed(decimals).replace(/\.0+$/, '');
  return feature.kind === 'numeric' && feature.unit ? `${text}${feature.unit === '%' ? '' : ' '}${feature.unit}` : text;
}

/** A test in plain words, e.g. "jacket is red", "distance < 6.1 m", "head and body match". */
export function formatTest(test: Test, features: readonly Feature[]): string {
  switch (test.kind) {
    case 'cat': {
      const f = features[test.feature];
      if (f.kind !== 'categorical') return '?';
      return f.describe ? f.describe(test.value, test.equal) : `${f.name} ${test.equal ? '=' : '≠'} ${f.values[test.value]}`;
    }
    case 'num': {
      const f = features[test.feature];
      return `${f.name} ${test.above ? '≥' : '<'} ${formatNumber(test.threshold, f)}`;
    }
    case 'same':
      return `${features[test.feature].name} and ${features[test.other].name} ${test.equal ? 'match' : "don't match"}`;
    case 'mofn': {
      const parts = test.tests.map((t) => formatTest(t, features)).join(', ');
      return test.atLeast ? `at least ${test.m} of {${parts}}` : `fewer than ${test.m} of {${parts}}`;
    }
  }
}

export function formatConditions(tests: readonly Test[], features: readonly Feature[]): string {
  return tests.length === 0 ? 'always' : tests.map((t) => formatTest(t, features)).join(' AND ');
}

export function formatRule(rule: Rule, features: readonly Feature[], classes: ClassNames): string {
  const then = rule.prediction === 1 ? classes.yes : classes.no;
  return rule.tests.length === 0 ? `ALWAYS ${then}` : `IF ${formatConditions(rule.tests, features)} THEN ${then}`;
}

export function formatList(list: RuleList, features: readonly Feature[], classes: ClassNames): string[] {
  const lines = list.rules.map((rule, i) => {
    const then = rule.prediction === 1 ? classes.yes : classes.no;
    return `${i === 0 ? 'IF' : 'ELSE IF'} ${formatConditions(rule.tests, features)} THEN ${then}`;
  });
  lines.push(`${list.rules.length === 0 ? 'ALWAYS' : 'ELSE'} ${list.fallback === 1 ? classes.yes : classes.no}`);
  return lines;
}
