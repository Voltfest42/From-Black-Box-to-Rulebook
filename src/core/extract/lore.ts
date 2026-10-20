import type { Instance, NumericFeature } from '../data/dataset';
import { growTree, leafClass, type DecisionTree, type TreeNode } from '../models/tree';
import { Random } from '../random';
import type { Labeler } from '../rules/metrics';
import { holds, negate, simplifyConjunction, type Test } from '../rules/rule';

/**
 * LORE (Guidotti et al., 2018) for numeric features.
 *
 * 1. Grow a neighbourhood of x with a genetic algorithm: one population that
 *    keeps x's decision and one that changes it, each pulled close to x, so the
 *    neighbourhood straddles the decision boundary.
 * 2. Fit a small decision tree to the black box's answers on the neighbourhood.
 * 3. The path to x's leaf is the factual rule. Paths to leaves with the other
 *    answer give counterfactual rules: the conditions x would have to change.
 */
export interface LoreOptions {
  /** Size of each of the two populations. */
  population?: number;
  generations?: number;
  maxDepth?: number;
  seed?: number;
}

export interface Counterfactual {
  /** The conditions of the leaf x would need to reach. */
  rule: Test[];
  /** Only the conditions x doesn't already satisfy: what has to change. */
  changes: Test[];
  /** The nearest point that satisfies the rule. */
  point: Instance;
  /** Distance from x, as a share of the feature ranges. */
  distance: number;
  /** Does the black box really answer differently there? */
  confirmed: boolean;
}

export interface LoreResult {
  neighbourhood: { x: Instance; label: number }[];
  tree: DecisionTree;
  /** Fidelity of the local tree to the black box on the neighbourhood. */
  localFidelity: number;
  factual: Test[];
  prediction: number;
  counterfactuals: Counterfactual[];
}

export function lore(label: Labeler, x: Instance, features: readonly NumericFeature[], options: LoreOptions = {}): LoreResult {
  const { population = 150, generations = 12, maxDepth = 3, seed = 1 } = options;
  const rng = new Random(seed);
  const target = label(x);
  const ranges = features.map((f) => f.max - f.min);
  const clamp = (z: number[]) => z.map((v, i) => Math.min(features[i].max, Math.max(features[i].min, v)));
  const distance = (z: Instance) => Math.sqrt(z.reduce((s, v, i) => s + ((v - x[i]) / ranges[i]) ** 2, 0));

  /** Fitness: close to x, with the wanted answer (and not x itself). */
  const evolve = (wantSame: boolean): Instance[] => {
    const fitness = (z: Instance) => ((label(z) === target) === wantSame ? 1 - Math.min(1, distance(z)) : 0) - (distance(z) < 1e-9 ? 1 : 0);
    let pop: Instance[] = Array.from({ length: population }, () => clamp(x.map((v, i) => v + rng.normal() * 0.3 * ranges[i])));
    for (let g = 0; g < generations; g++) {
      const scored = pop.map((z) => ({ z, f: fitness(z) })).sort((a, b) => b.f - a.f);
      const parents = scored.slice(0, Math.max(2, Math.floor(population / 2))).map((s) => s.z);
      const children: Instance[] = [];
      while (children.length < population - parents.length) {
        const a = rng.pick(parents);
        const b = rng.pick(parents);
        // Crossover: each feature from either parent; mutation: a small random nudge.
        const child = a.map((v, i) => (rng.bernoulli(0.5) ? v : b[i]) + (rng.bernoulli(0.3) ? rng.normal() * 0.08 * ranges[i] : 0));
        children.push(clamp(child));
      }
      pop = [...parents, ...children];
    }
    return pop;
  };

  const neighbourhood = [...evolve(true), ...evolve(false)].map((z) => ({ x: z, label: label(z) }));
  const tree = growTree(
    features,
    neighbourhood.map((n) => n.x),
    neighbourhood.map((n) => n.label),
    { maxDepth, minLeaf: 4 },
  );
  const localFidelity = neighbourhood.filter((n) => tree.predict(n.x) === n.label).length / neighbourhood.length;

  // Factual rule: the path to x's leaf.
  const paths: { tests: Test[]; leaf: TreeNode }[] = [];
  const walk = (node: TreeNode, path: Test[]) => {
    if (!node.test) {
      paths.push({ tests: path, leaf: node });
      return;
    }
    walk(node.yes!, [...path, node.test]);
    walk(node.no!, [...path, negate(node.test)]);
  };
  walk(tree.root, []);
  const mine = paths.find((p) => p.tests.every((t) => holds(t, x)))!;
  const prediction = leafClass(mine.leaf);

  // Counterfactual rules: other-answer leaves, nearest first.
  const counterfactuals = paths
    .filter((p) => leafClass(p.leaf) !== prediction)
    .map((p) => {
      const rule = simplifyConjunction(p.tests, features);
      const changes = rule.filter((t) => !holds(t, x)).sort((a, b) => featureOf(a) - featureOf(b));
      const point = confirmedPoint(x, rule, features, (z) => label(z) !== target);
      return { rule, changes, point, distance: distance(point), confirmed: label(point) !== target };
    })
    // Confirmed by the black box first, then fewest changes, then nearest.
    .sort((a, b) => Number(b.confirmed) - Number(a.confirmed) || a.changes.length - b.changes.length || a.distance - b.distance)
    // Two leaves can ask for the same changes; keep the first (best) of each.
    .filter((c, i, all) => all.findIndex((d) => changeKey(d.changes) === changeKey(c.changes)) === i);

  return { neighbourhood, tree, localFidelity, factual: simplifyConjunction(mine.tests, features), prediction, counterfactuals };
}

/**
 * The nearest point in a counterfactual leaf where the black box really does
 * answer differently: start just past the thresholds, then walk towards the
 * middle of the leaf's box until the answer flips (the local tree's boundary is
 * only an approximation of the model's).
 */
export function confirmedPoint(x: Instance, tests: readonly Test[], features: readonly NumericFeature[], flipped: (z: Instance) => boolean): Instance {
  const start = nearestSatisfying(x, tests, features);
  if (flipped(start)) return start;
  // The leaf's box, from its conditions.
  const lo = features.map((f) => f.min);
  const hi = features.map((f) => f.max);
  for (const t of tests) {
    if (t.kind !== 'num') continue;
    if (t.above) lo[t.feature] = Math.max(lo[t.feature], t.threshold);
    else hi[t.feature] = Math.min(hi[t.feature], t.threshold);
  }
  const centre = features.map((_, i) => (lo[i] + hi[i]) / 2);
  for (let k = 1; k <= 20; k++) {
    const z = start.map((v, i) => v + ((centre[i] - v) * k) / 20);
    if (flipped(z)) return z;
  }
  return start;
}

/** Move x the least amount needed to satisfy every (numeric) condition: just past each threshold. */
export function nearestSatisfying(x: Instance, tests: readonly Test[], features: readonly NumericFeature[]): Instance {
  const z = [...x];
  for (const t of tests) {
    if (t.kind !== 'num' || holds(t, z)) continue;
    const step = (features[t.feature].max - features[t.feature].min) * 0.005;
    z[t.feature] = t.above ? t.threshold + step : t.threshold - step;
  }
  return z;
}

function featureOf(t: Test): number {
  return t.kind === 'mofn' ? -1 : t.feature;
}

/** The same changes give the same key (thresholds to 0.1). */
function changeKey(tests: readonly Test[]): string {
  return tests.map((t) => JSON.stringify(t.kind === 'num' ? { ...t, threshold: Math.round(t.threshold * 10) / 10 } : t)).join('|');
}
