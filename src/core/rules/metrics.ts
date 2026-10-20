import type { Instance } from '../data/dataset';
import { fires, type Rule } from './rule';

/** Anything that can label a case: a network, a forest, a rule list, the game's own logic. */
export type Labeler = (x: Instance) => number;

/** Labels for a list of cases. */
export function labelAll(label: Labeler, X: readonly Instance[]): number[] {
  return X.map((x) => label(x));
}

/** Share of positions where two label lists agree. */
export function agreement(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) throw new Error('label lists differ in length');
  if (a.length === 0) return 1;
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length;
}

/**
 * Fidelity: how often the rules agree with the model.
 * Accuracy is the same calculation against the true labels instead.
 */
export function fidelity(rules: Labeler, model: Labeler, X: readonly Instance[]): number {
  return agreement(labelAll(rules, X), labelAll(model, X));
}

/** Share of cases where the rule's conditions hold. */
export function coverage(rule: Rule, X: readonly Instance[]): number {
  if (X.length === 0) return 0;
  let n = 0;
  for (const x of X) if (fires(rule, x)) n++;
  return n / X.length;
}

/**
 * Among the cases the rule covers, the share whose label matches its prediction.
 * `null` when it covers nothing.
 */
export function precision(rule: Rule, X: readonly Instance[], labels: readonly number[]): number | null {
  let covered = 0;
  let right = 0;
  X.forEach((x, i) => {
    if (!fires(rule, x)) return;
    covered++;
    if (labels[i] === rule.prediction) right++;
  });
  return covered === 0 ? null : right / covered;
}

/** Confusion counts of predictions against reference labels. */
export function confusion(predicted: readonly number[], actual: readonly number[]) {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  for (let i = 0; i < predicted.length; i++) {
    if (predicted[i] === 1) {
      if (actual[i] === 1) tp++;
      else fp++;
    } else if (actual[i] === 0) tn++;
    else fn++;
  }
  return { tp, fp, tn, fn };
}

export function percent(x: number, decimals = 0): string {
  return `${(x * 100).toFixed(decimals)}%`;
}
