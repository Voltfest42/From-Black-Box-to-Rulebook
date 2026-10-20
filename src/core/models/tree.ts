import type { Feature, Instance } from '../data/dataset';
import { holds, negate, simplifyConjunction, type Rule, type Test } from '../rules/rule';

/**
 * A binary decision tree. Each internal node asks one test; cases where it
 * holds go to `yes`, the others to `no`. Leaves predict by majority.
 */
export interface TreeNode {
  id: number;
  depth: number;
  /** Weighted class totals [no, yes] of the training cases that reach this node. */
  counts: [number, number];
  /** Number of training cases that reach this node. */
  n: number;
  test?: Test;
  yes?: TreeNode;
  no?: TreeNode;
}

export interface TreeOptions {
  maxDepth?: number;
  /** Grow best-first and stop at this many leaves. */
  maxLeaves?: number;
  /** Smallest number of cases allowed in a leaf. */
  minLeaf?: number;
  /** A split must reduce impurity (weighted Gini, as a share of the whole set) by at least this much. */
  minGain?: number;
  /** Per-case weights (default 1). */
  weights?: readonly number[];
  /** Numeric features may only split at these thresholds (per feature index), e.g. quantiles. */
  thresholds?: ReadonlyMap<number, readonly number[]>;
  /** Only these features may be split on (all by default). */
  allowed?: readonly number[];
}

export type TreeEvent = { kind: 'split'; node: number; test: Test; gain: number; leaves: number };

export class DecisionTree {
  readonly root: TreeNode;
  readonly features: readonly Feature[];

  constructor(root: TreeNode, features: readonly Feature[]) {
    this.root = root;
    this.features = features;
  }

  leafFor(x: Instance): TreeNode {
    let node = this.root;
    while (node.test) node = holds(node.test, x) ? node.yes! : node.no!;
    return node;
  }

  /** Share of "yes" among the training cases in x's leaf. */
  predictProba(x: Instance): number {
    return leafProba(this.leafFor(x));
  }

  predict(x: Instance): number {
    return leafClass(this.leafFor(x));
  }

  leaves(): TreeNode[] {
    const out: TreeNode[] = [];
    walk(this.root, (node) => !node.test && out.push(node));
    return out;
  }

  get leafCount(): number {
    return this.leaves().length;
  }

  get depth(): number {
    let depth = 0;
    walk(this.root, (node) => (depth = Math.max(depth, node.depth)));
    return depth;
  }

  /** One rule per leaf: the tests on the path to it, tidied up. */
  rules(): Rule[] {
    return pathRules(this.root, this.features);
  }

  /** The rules for "yes" only: together they form a rule set equivalent to the tree. */
  yesRules(): Rule[] {
    return this.rules().filter((r) => r.prediction === 1);
  }
}

export function leafProba(node: TreeNode): number {
  const total = node.counts[0] + node.counts[1];
  return total > 0 ? node.counts[1] / total : 0.5;
}

/** Majority class; ties go to "no". */
export function leafClass(node: TreeNode): number {
  return node.counts[1] > node.counts[0] ? 1 : 0;
}

export function walk(node: TreeNode, visit: (node: TreeNode) => void): void {
  visit(node);
  if (node.yes) walk(node.yes, visit);
  if (node.no) walk(node.no, visit);
}

/** The path tests to every leaf, tidied, with the leaf's majority class as the prediction. */
export function pathRules(root: TreeNode, features: readonly Feature[]): Rule[] {
  const rules: Rule[] = [];
  const visit = (node: TreeNode, path: Test[]) => {
    if (!node.test) {
      rules.push({ tests: simplifyConjunction(path, features), prediction: leafClass(node) });
      return;
    }
    visit(node.yes!, [...path, node.test]);
    visit(node.no!, [...path, negate(node.test)]);
  };
  visit(root, []);
  return rules;
}

/** Candidate tests for one feature over a set of cases. */
export function candidateTests(
  feature: Feature,
  index: number,
  X: readonly Instance[],
  rows: readonly number[],
  thresholds?: readonly number[],
): Test[] {
  if (feature.kind === 'categorical') {
    const present = new Set(rows.map((r) => X[r][index]));
    // With two values, "= a" and "= b" are the same split; keep one.
    const values = feature.values.map((_, v) => v).filter((v) => present.has(v));
    const usable = feature.values.length === 2 ? values.slice(0, 1) : values;
    return usable.map((value) => ({ kind: 'cat', feature: index, value, equal: true }));
  }
  if (thresholds) {
    return thresholds.map((threshold) => ({ kind: 'num', feature: index, threshold, above: true }));
  }
  // Midpoints between consecutive distinct values.
  const values = [...new Set(rows.map((r) => X[r][index]))].sort((a, b) => a - b);
  const tests: Test[] = [];
  for (let i = 1; i < values.length; i++) {
    tests.push({ kind: 'num', feature: index, threshold: (values[i - 1] + values[i]) / 2, above: true });
  }
  return tests;
}

export function gini(no: number, yes: number): number {
  const total = no + yes;
  if (total <= 0) return 0;
  const p = yes / total;
  return 2 * p * (1 - p);
}

interface Split {
  test: Test;
  gain: number;
  yesRows: number[];
  noRows: number[];
}

/**
 * CART-style growth: best-first by weighted Gini decrease, so `maxLeaves` keeps
 * the most useful splits. Without a leaf limit the result equals depth-first
 * growth. Ties are broken by feature order, then threshold, so runs repeat.
 */
export function growTree(
  features: readonly Feature[],
  X: readonly Instance[],
  y: readonly number[],
  options: TreeOptions = {},
  emit?: (event: TreeEvent) => void,
): DecisionTree {
  const { maxDepth = Infinity, maxLeaves = Infinity, minLeaf = 1, minGain = 1e-12, weights, thresholds, allowed } = options;
  const weight = (r: number) => (weights ? weights[r] : 1);
  const totalWeight = X.reduce((s, _, r) => s + weight(r), 0) || 1;
  let nextId = 0;

  const makeNode = (rows: number[], depth: number): TreeNode => {
    const counts: [number, number] = [0, 0];
    for (const r of rows) counts[y[r]] += weight(r);
    return { id: nextId++, depth, counts, n: rows.length };
  };

  const bestSplit = (node: TreeNode, rows: number[]): Split | null => {
    if (node.depth >= maxDepth || rows.length < 2 * minLeaf) return null;
    if (node.counts[0] === 0 || node.counts[1] === 0) return null;
    const parentImpurity = gini(node.counts[0], node.counts[1]);
    const nodeWeight = node.counts[0] + node.counts[1];
    let best: Split | null = null;
    const featureIndices = allowed ?? features.map((_, i) => i);
    for (const f of featureIndices) {
      for (const test of candidateTests(features[f], f, X, rows, thresholds?.get(f))) {
        const yesRows: number[] = [];
        const noRows: number[] = [];
        let yesNo = 0;
        let yesYes = 0;
        let noNo = 0;
        let noYes = 0;
        for (const r of rows) {
          if (holds(test, X[r])) {
            yesRows.push(r);
            if (y[r] === 1) yesYes += weight(r);
            else yesNo += weight(r);
          } else {
            noRows.push(r);
            if (y[r] === 1) noYes += weight(r);
            else noNo += weight(r);
          }
        }
        if (yesRows.length < minLeaf || noRows.length < minLeaf) continue;
        const wYes = yesNo + yesYes;
        const wNo = noNo + noYes;
        const childImpurity = (wYes * gini(yesNo, yesYes) + wNo * gini(noNo, noYes)) / nodeWeight;
        const gain = (nodeWeight / totalWeight) * (parentImpurity - childImpurity);
        if (gain > minGain && (!best || gain > best.gain + 1e-12)) best = { test, gain, yesRows, noRows };
      }
    }
    return best;
  };

  const allRows = X.map((_, r) => r);
  const root = makeNode(allRows, 0);
  const frontier: { node: TreeNode; split: Split }[] = [];
  const consider = (node: TreeNode, rows: number[]) => {
    const split = bestSplit(node, rows);
    if (split) frontier.push({ node, split });
  };
  consider(root, allRows);

  let leaves = 1;
  while (frontier.length > 0 && leaves < maxLeaves) {
    // Highest gain first; the lowest id breaks ties, so the order is repeatable.
    let pick = 0;
    for (let i = 1; i < frontier.length; i++) {
      const a = frontier[i];
      const b = frontier[pick];
      if (a.split.gain > b.split.gain + 1e-12 || (Math.abs(a.split.gain - b.split.gain) <= 1e-12 && a.node.id < b.node.id)) pick = i;
    }
    const [{ node, split }] = frontier.splice(pick, 1);
    node.test = split.test;
    node.yes = makeNode(split.yesRows, node.depth + 1);
    node.no = makeNode(split.noRows, node.depth + 1);
    leaves++;
    emit?.({ kind: 'split', node: node.id, test: split.test, gain: split.gain, leaves });
    consider(node.yes, split.yesRows);
    consider(node.no, split.noRows);
  }

  return new DecisionTree(root, features);
}
