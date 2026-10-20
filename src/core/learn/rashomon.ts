import type { Instance } from '../data/dataset';
import { and, bitsFrom, count, type Bits } from '../rules/bitset';
import type { Test } from '../rules/rule';
import { DecisionTree, type TreeNode } from '../models/tree';

/**
 * Every decision tree of depth at most 2 on two numeric features, with splits on
 * a grid of thresholds, scored exactly. The Rashomon set (Semenova, Rudin &
 * Parr, 2022; Xin et al., 2022) is every tree whose score is within ε of the best.
 *
 * Score = share of training cases misclassified + λ × leaves, like CORELS.
 */
export interface SmallTree {
  root: number;
  /** Split under the root's "yes" side and "no" side; -1 = leaf. */
  yes: number;
  no: number;
  errors: number;
  leaves: number;
  objective: number;
}

export interface RashomonSpace {
  splits: Test[];
  trees: SmallTree[];
  best: number;
  n: number;
}

export function enumerateSmallTrees(X: readonly Instance[], y: readonly number[], splits: readonly Test[], lambda = 0.01): RashomonSpace {
  const n = X.length;
  const positive = bitsFrom(n, (i) => y[i] === 1);
  const masks = splits.map((t) => bitsFrom(n, (i) => t.kind === 'num' && X[i][t.feature] >= t.threshold === t.above));
  const everyone = bitsFrom(n, () => true);
  const not = (b: Bits): Bits => b.map((w, k) => everyone[k] & ~w);
  const leafErrors = (region: Bits) => {
    const c = count(region);
    const p = count(and(region, positive));
    return Math.min(p, c - p);
  };
  // Errors on one side of the root, for each choice below it (leaf or a split).
  const sideErrors = (region: Bits) => [leafErrors(region), ...masks.map((m) => leafErrors(and(region, m)) + leafErrors(and(region, not(m))))];

  const trees: SmallTree[] = [];
  masks.forEach((m, root) => {
    const yesSide = sideErrors(m);
    const noSide = sideErrors(not(m));
    for (let a = 0; a < yesSide.length; a++) {
      for (let b = 0; b < noSide.length; b++) {
        const leaves = 2 + (a > 0 ? 1 : 0) + (b > 0 ? 1 : 0);
        const errors = yesSide[a] + noSide[b];
        trees.push({ root, yes: a - 1, no: b - 1, errors, leaves, objective: errors / n + lambda * leaves });
      }
    }
  });
  const best = Math.min(...trees.map((t) => t.objective));
  return { splits: [...splits], trees, best, n };
}

/** The trees within ε of the best score. */
export function rashomonSet(space: RashomonSpace, epsilon: number): SmallTree[] {
  return space.trees.filter((t) => t.objective <= space.best + epsilon + 1e-12);
}

/** A SmallTree as a DecisionTree, with leaf labels fitted to the training data. */
export function toDecisionTree(tree: SmallTree, space: RashomonSpace, X: readonly Instance[], y: readonly number[], features: DecisionTree['features']): DecisionTree {
  let id = 0;
  const leaf = (rows: number[], depth: number): TreeNode => {
    const counts: [number, number] = [0, 0];
    for (const r of rows) counts[y[r]]++;
    return { id: id++, depth, counts, n: rows.length };
  };
  const holdsSplit = (s: number, x: Instance) => {
    const t = space.splits[s];
    return t.kind === 'num' && x[t.feature] >= t.threshold === t.above;
  };
  const branch = (rows: number[], split: number, depth: number): TreeNode => {
    if (split < 0) return leaf(rows, depth);
    const node = leaf(rows, depth);
    node.test = space.splits[split];
    node.yes = leaf(rows.filter((r) => holdsSplit(split, X[r])), depth + 1);
    node.no = leaf(rows.filter((r) => !holdsSplit(split, X[r])), depth + 1);
    return node;
  };
  const all = X.map((_, r) => r);
  const root = leaf(all, 0);
  root.test = space.splits[tree.root];
  root.yes = branch(all.filter((r) => holdsSplit(tree.root, X[r])), tree.yes, 1);
  root.no = branch(all.filter((r) => !holdsSplit(tree.root, X[r])), tree.no, 1);
  return new DecisionTree(root, features);
}

/** Thresholds every `step` along each numeric feature's range. */
export function gridSplits(ranges: readonly { min: number; max: number }[], steps = 20): Test[] {
  const out: Test[] = [];
  ranges.forEach((r, feature) => {
    for (let k = 1; k < steps; k++) out.push({ kind: 'num', feature, threshold: r.min + ((r.max - r.min) * k) / steps, above: true });
  });
  return out;
}
