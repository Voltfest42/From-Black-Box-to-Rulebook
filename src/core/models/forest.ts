import type { Feature, Instance } from '../data/dataset';
import { Random } from '../random';
import { negate, simplifyConjunction, type Rule, type Test } from '../rules/rule';
import { DecisionTree, growTree, leafProba, type TreeNode } from './tree';

/**
 * A random forest (Breiman, 2001): many trees, each grown on a bootstrap sample
 * of the data with a random choice of features at each split, voting together.
 */
export interface ForestOptions {
  trees?: number;
  maxDepth?: number;
  featuresPerSplit?: number;
  /** Numeric features may only split at these thresholds (SIRUS uses quantiles). */
  thresholds?: ReadonlyMap<number, readonly number[]>;
  minLeaf?: number;
  seed?: number;
}

export class Forest {
  readonly trees: readonly DecisionTree[];

  constructor(trees: readonly DecisionTree[]) {
    this.trees = trees;
  }

  /** Average of the trees' leaf probabilities. */
  proba(x: Instance): number {
    let s = 0;
    for (const t of this.trees) s += leafProba(t.leafFor(x));
    return s / this.trees.length;
  }

  label(x: Instance): number {
    return this.proba(x) >= 0.5 ? 1 : 0;
  }
}

export function randomForest(features: readonly Feature[], X: readonly Instance[], y: readonly number[], options: ForestOptions = {}): Forest {
  const { trees = 100, maxDepth = 3, featuresPerSplit = Math.max(1, Math.round(Math.sqrt(features.length))), thresholds, minLeaf = 3, seed = 1 } = options;
  const rng = new Random(seed);
  const grown: DecisionTree[] = [];
  for (let t = 0; t < trees; t++) {
    const rows = Array.from({ length: X.length }, () => rng.int(X.length));
    grown.push(
      growTree(
        features,
        rows.map((r) => X[r]),
        rows.map((r) => y[r]),
        { maxDepth, featuresPerSplit, thresholds, minLeaf, seed: rng.int(1e9) },
      ),
    );
  }
  return new Forest(grown);
}

/** A key that is the same for two rules with the same conditions. */
export function ruleKey(tests: readonly Test[]): string {
  return JSON.stringify(
    [...tests]
      .map((t) => (t.kind === 'num' ? { ...t, threshold: Math.round(t.threshold * 1e6) / 1e6 } : t))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  );
}

/**
 * Every node of every tree except the roots, as the conjunction of tests that
 * leads to it (RuleFit's rule generation). `count` says in how many trees the
 * same rule appears (what SIRUS ranks by).
 */
export function forestRules(forest: Forest, features: readonly Feature[]): { tests: Test[]; count: number }[] {
  const found = new Map<string, { tests: Test[]; count: number }>();
  for (const tree of forest.trees) {
    const inThisTree = new Set<string>();
    const visit = (node: TreeNode, path: Test[]) => {
      if (path.length > 0) {
        const tests = simplifyConjunction(path, features);
        const key = ruleKey(tests);
        if (!inThisTree.has(key)) {
          inThisTree.add(key);
          const entry = found.get(key) ?? { tests, count: 0 };
          entry.count++;
          found.set(key, entry);
        }
      }
      if (node.test) {
        visit(node.yes!, [...path, node.test]);
        visit(node.no!, [...path, negate(node.test)]);
      }
    };
    visit(tree.root, []);
  }
  return [...found.values()];
}

export function asRule(tests: readonly Test[], prediction = 1): Rule {
  return { tests, prediction };
}
