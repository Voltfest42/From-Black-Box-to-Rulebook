import type { CategoricalFeature, Encoder, Instance } from '../data/dataset';
import type { Mlp } from '../models/mlp';
import { and, bitsFrom, count, forEachBit, isEmpty, isSubset, type Bits } from '../rules/bitset';
import type { Test } from '../rules/rule';
import { subsetSearch, type Literal } from './subsets';

/**
 * Layer-by-layer ("decompositional") extraction from a network with one hidden
 * layer and categorical inputs, in the spirit of KT (Fu, 1991):
 *
 * 1. For every hidden unit, find the minimal conjunctions of conditions that
 *    guarantee it is on, and the ones that guarantee it is off.
 * 2. Treat the hidden units as yes/no switches and find the rules for the output.
 * 3. Substitute the hidden-unit rules into the output rules.
 *
 * The input space is small (432 robots), so "guarantees" is checked exactly:
 * a conjunction guarantees a unit is on when the unit is on for every case the
 * conjunction covers.
 */

/** A conjunction of conditions, with the cases it covers. */
export interface Conjunction {
  tests: Test[];
  coverage: Bits;
}

export interface UnitRules {
  unit: number;
  on: Conjunction[];
  off: Conjunction[];
  /** Conjunctions tested while searching (both states). */
  examined: number;
}

export interface NetworkExtraction {
  /** Size of the conjunction space searched per unit and state. */
  space: number;
  units: UnitRules[];
  /** Output rules over hidden units: literal value 1 = "unit on". */
  outputRules: Literal[][];
  outputExamined: number;
  /** How many input-level rules substitution produces before any tidying. */
  substituted: number;
  /** The network with every hidden unit rounded to on/off, per case. */
  binarized: number[];
  /** A short rule set for the binarized network: prime conjunctions, then a greedy cover. */
  simplified: Conjunction[];
  /** Prime conjunctions considered by the simplification. */
  primes: number;
}

/** Every conjunction of at most one condition per feature: none, "= v", or (for 3+ values) "≠ v". */
export function conjunctionSpace(features: readonly CategoricalFeature[]): Test[][] {
  let all: Test[][] = [[]];
  features.forEach((f, index) => {
    const options: (Test | null)[] = [null];
    f.values.forEach((_, value) => {
      options.push({ kind: 'cat', feature: index, value, equal: true });
      if (f.values.length > 2) options.push({ kind: 'cat', feature: index, value, equal: false });
    });
    const next: Test[][] = [];
    for (const prefix of all) for (const option of options) next.push(option ? [...prefix, option] : prefix);
    all = next;
  });
  return all.sort((a, b) => a.length - b.length);
}

interface Space {
  conjunctions: Test[][];
  coverage: Bits[];
}

function buildSpace(features: readonly CategoricalFeature[], cases: readonly Instance[]): Space {
  const conjunctions = conjunctionSpace(features);
  const testBits = new Map<string, Bits>();
  const bitsOf = (t: Test) => {
    const key = JSON.stringify(t);
    let b = testBits.get(key);
    if (!b) {
      b = bitsFrom(cases.length, (i) => t.kind === 'cat' && (cases[i][t.feature] === t.value) === t.equal);
      testBits.set(key, b);
    }
    return b;
  };
  const all = bitsFrom(cases.length, () => true);
  const coverage = conjunctions.map((tests) => tests.reduce((acc, t) => and(acc, bitsOf(t)), all));
  return { conjunctions, coverage };
}

/**
 * The minimal conjunctions whose covered cases all satisfy `good`: tried smallest
 * first, keeping a valid one only if no rule found so far already covers it.
 */
export function minimalConjunctions(space: Space, good: (i: number) => boolean): { rules: Conjunction[]; examined: number } {
  const rules: Conjunction[] = [];
  let examined = 0;
  space.conjunctions.forEach((tests, k) => {
    const coverage = space.coverage[k];
    examined++;
    if (isEmpty(coverage)) return;
    let valid = true;
    forEachBit(coverage, (i) => (good(i) ? undefined : (valid = false)));
    if (!valid) return;
    if (rules.some((r) => isSubset(coverage, r.coverage))) return;
    rules.push({ tests, coverage });
  });
  return { rules, examined };
}

export function extractNetwork(net: Mlp, encoder: Encoder, features: readonly CategoricalFeature[], cases: readonly Instance[]): NetworkExtraction {
  if (net.sizes.length !== 3) throw new Error('expected one hidden layer');
  const space = buildSpace(features, cases);
  const hidden = net.sizes[1];
  const inputs = net.sizes[0];

  // Each hidden unit's total input for every case: on when it is above 0.
  const z = Array.from({ length: hidden }, (_, h) =>
    cases.map((x) => {
      const v = encoder.encode(x);
      let s = net.b[0][h];
      for (let i = 0; i < inputs; i++) s += net.W[0][h * inputs + i] * v[i];
      return s;
    }),
  );

  const units: UnitRules[] = z.map((zs, unit) => {
    const on = minimalConjunctions(space, (i) => zs[i] > 0);
    const off = minimalConjunctions(space, (i) => zs[i] <= 0);
    return { unit, on: on.rules, off: off.rules, examined: on.examined + off.examined };
  });

  // The output neuron, reading the hidden units as on (1) / off (0).
  const output = subsetSearch({ weights: Array.from(net.W[1]), bias: net.b[1][0] });
  const outputRules = output.rules;

  const substituted = outputRules.reduce(
    (total, rule) => total + rule.reduce((product, l) => product * (l.value === 1 ? units[l.input].on : units[l.input].off).length, 1),
    0,
  );

  const binarized = cases.map((_, i) => (outputRules.some((rule) => rule.every((l) => (z[l.input][i] > 0 ? 1 : 0) === l.value)) ? 1 : 0));

  // Tidy: every minimal conjunction inside the "yes" cases, then a greedy cover.
  const primes = minimalConjunctions(space, (i) => binarized[i] === 1).rules;
  const simplified = greedyCover(primes, bitsFrom(cases.length, (i) => binarized[i] === 1));

  return {
    space: space.conjunctions.length,
    units,
    outputRules,
    outputExamined: output.examined,
    substituted,
    binarized,
    simplified,
    primes: primes.length,
  };
}

/** Repeatedly take the rule covering the most still-uncovered cases (ties: fewer conditions). */
export function greedyCover(rules: readonly Conjunction[], target: Bits): Conjunction[] {
  const chosen: Conjunction[] = [];
  let remaining: Bits = target.slice();
  while (!isEmpty(remaining)) {
    let best: Conjunction | null = null;
    let bestGain = 0;
    for (const r of rules) {
      const gain = count(and(r.coverage, remaining));
      if (gain > bestGain || (gain === bestGain && gain > 0 && best && r.tests.length < best.tests.length)) {
        best = r;
        bestGain = gain;
      }
    }
    if (!best) break;
    chosen.push(best);
    const taken = best.coverage;
    remaining = remaining.map((w, k) => w & ~taken[k]);
  }
  return chosen;
}
