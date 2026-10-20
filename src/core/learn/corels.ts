import type { CategoricalFeature, Instance } from '../data/dataset';
import { and, bitsFrom, count, type Bits } from '../rules/bitset';
import { holds, type Rule, type RuleList, type Test } from '../rules/rule';

/**
 * CORELS (Angelino, Larus-Stone, Alabi, Seltzer & Rudin, KDD 2017 / JMLR 2018):
 * the provably best rule list for an objective that charges for both mistakes
 * and length,
 *
 *   R(list) = (share of training cases misclassified) + λ × (number of rules),
 *
 * found by branch and bound over rule-list prefixes. Each rule's prediction is
 * the majority of the cases it is first to capture; the final ELSE predicts the
 * majority of what's left. Bounds used (all from the paper):
 *
 * - hierarchical lower bound: the mistakes a prefix already makes, plus λ per
 *   rule, can only grow when the prefix is extended;
 * - lookahead: extending adds at least λ, so a prefix within λ of the best is done;
 * - minimum support: a rule must capture, and correctly classify, at least λ × n
 *   new cases, or dropping it would score better;
 * - permutations: prefixes with the same rules in another order capture the same
 *   cases, so only the better one is kept.
 *
 * When the queue of unexplored prefixes empties, the best list is certified optimal.
 */
export interface Antecedent {
  tests: Test[];
  captures: Bits;
}

export interface CorelsOptions {
  lambda?: number;
  maxLength?: number;
  /** Safety cap; if reached, the result is not certified. */
  maxNodes?: number;
  /** Progress events every this many prefixes. */
  every?: number;
}

export type CorelsEvent =
  | { kind: 'best'; nodes: number; list: RuleList; objective: number; errors: number }
  | { kind: 'progress'; nodes: number; best: number; frontier: number; queue: number; pruned: PruneCounts };

export interface PruneCounts {
  bound: number;
  support: number;
  permutation: number;
}

export interface CorelsResult {
  list: RuleList;
  objective: number;
  errors: number;
  nodes: number;
  certified: boolean;
  pruned: PruneCounts;
  antecedents: number;
}

/** Single conditions, "≠" conditions (for 3+ values) and pairs of "=" conditions on different features. */
export function robotAntecedents(features: readonly CategoricalFeature[], X: readonly Instance[]): Antecedent[] {
  const singles: Test[] = [];
  features.forEach((f, feature) =>
    f.values.forEach((_, value) => {
      singles.push({ kind: 'cat', feature, value, equal: true });
      if (f.values.length > 2) singles.push({ kind: 'cat', feature, value, equal: false });
    }),
  );
  const tests: Test[][] = singles.map((t) => [t]);
  const equals = singles.filter((t) => t.kind === 'cat' && t.equal);
  for (let a = 0; a < equals.length; a++) {
    for (let b = a + 1; b < equals.length; b++) {
      const ta = equals[a];
      const tb = equals[b];
      if (ta.kind === 'cat' && tb.kind === 'cat' && ta.feature !== tb.feature) tests.push([ta, tb]);
    }
  }
  return tests
    .map((t) => ({ tests: t, captures: bitsFrom(X.length, (i) => t.every((c) => holds(c, X[i]))) }))
    .filter((a) => count(a.captures) > 0);
}

interface Node {
  prefix: number[];
  predictions: number[];
  captured: Bits;
  errors: number;
  lower: number;
}

export function corels(antecedents: readonly Antecedent[], y: readonly number[], options: CorelsOptions = {}, emit?: (e: CorelsEvent) => void): CorelsResult {
  const { lambda = 0.01, maxLength = 5, maxNodes = 4_000_000, every = 500 } = options;
  const n = y.length;
  const positive = bitsFrom(n, (i) => y[i] === 1);
  const minSupport = lambda * n;
  const pruned: PruneCounts = { bound: 0, support: 0, permutation: 0 };

  const objectiveOf = (node: Node) => {
    const left = n - count(node.captured);
    const leftPositive = count(positive) - count(and(node.captured, positive));
    const defaultPrediction = leftPositive * 2 > left ? 1 : 0;
    const defaultErrors = defaultPrediction === 1 ? left - leftPositive : leftPositive;
    const errors = node.errors + defaultErrors;
    return { objective: errors / n + lambda * node.prefix.length, errors, defaultPrediction };
  };
  const toList = (node: Node, defaultPrediction: number): RuleList => ({
    rules: node.prefix.map((j, k): Rule => ({ tests: antecedents[j].tests, prediction: node.predictions[k] })),
    fallback: defaultPrediction,
  });

  const root: Node = { prefix: [], predictions: [], captured: new Uint32Array(Math.ceil(n / 32)), errors: 0, lower: 0 };
  const start = objectiveOf(root);
  let best = { objective: start.objective, errors: start.errors, list: toList(root, start.defaultPrediction) };
  emit?.({ kind: 'best', nodes: 0, list: best.list, objective: best.objective, errors: best.errors });

  const heap = new MinHeap<Node>((a, b) => a.lower - b.lower || a.prefix.length - b.prefix.length);
  heap.push(root);
  const seen = new Map<string, number>();
  let nodes = 0;
  let frontier = 0;

  while (heap.size > 0 && nodes < maxNodes) {
    const node = heap.pop()!;
    frontier = node.lower;
    // Lookahead: any extension costs at least λ more.
    if (node.lower + lambda >= best.objective) {
      pruned.bound++;
      continue;
    }
    for (let j = 0; j < antecedents.length; j++) {
      if (node.prefix.includes(j)) continue;
      nodes++;
      const fresh = antecedents[j].captures.map((w, k) => w & ~node.captured[k]);
      const captured = count(fresh);
      if (captured < minSupport) {
        pruned.support++;
        continue;
      }
      const pos = count(and(fresh, positive));
      const prediction = pos * 2 > captured ? 1 : 0;
      const correct = prediction === 1 ? pos : captured - pos;
      if (correct < minSupport) {
        pruned.support++;
        continue;
      }
      const child: Node = {
        prefix: [...node.prefix, j],
        predictions: [...node.predictions, prediction],
        captured: node.captured.map((w, k) => w | fresh[k]),
        errors: node.errors + (captured - correct),
        lower: 0,
      };
      child.lower = child.errors / n + lambda * child.prefix.length;
      if (child.lower >= best.objective) {
        pruned.bound++;
        continue;
      }
      const { objective, errors, defaultPrediction } = objectiveOf(child);
      if (objective < best.objective - 1e-12) {
        best = { objective, errors, list: toList(child, defaultPrediction) };
        emit?.({ kind: 'best', nodes, list: best.list, objective, errors });
      }
      // Permutation bound: the same rules in another order capture the same cases.
      const key = [...child.prefix].sort((a, b) => a - b).join(',');
      const previous = seen.get(key);
      if (previous !== undefined && previous <= child.lower) {
        pruned.permutation++;
        continue;
      }
      seen.set(key, child.lower);
      if (child.prefix.length < maxLength && child.lower + lambda < best.objective) heap.push(child);
      if (nodes % every === 0) emit?.({ kind: 'progress', nodes, best: best.objective, frontier, queue: heap.size, pruned: { ...pruned } });
    }
  }
  const certified = heap.size === 0 || (heap.peek()?.lower ?? Infinity) + lambda >= best.objective;
  emit?.({ kind: 'progress', nodes, best: best.objective, frontier: certified ? best.objective : frontier, queue: heap.size, pruned: { ...pruned } });
  return { list: best.list, objective: best.objective, errors: best.errors, nodes, certified, pruned, antecedents: antecedents.length };
}

/** Number of possible rule lists of up to `length` rules from m antecedents (ordered, no repeats). */
export function listCount(m: number, length: number): number {
  let total = 1;
  let term = 1;
  for (let k = 1; k <= length; k++) {
    term *= m - k + 1;
    total += term;
  }
  return total;
}

class MinHeap<T> {
  private items: T[] = [];
  private readonly less: (a: T, b: T) => number;

  constructor(less: (a: T, b: T) => number) {
    this.less = less;
  }

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  push(item: T): void {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.less(a[i], a[parent]) >= 0) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m]) < 0) m = l;
        if (r < a.length && this.less(a[r], a[m]) < 0) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}
