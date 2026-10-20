import type { Feature, Instance } from '../data/dataset';
import { candidateTests, DecisionTree, type TreeNode } from '../models/tree';
import { Random } from '../random';
import type { Labeler } from '../rules/metrics';
import { holds, negate, type Test } from '../rules/rule';

/**
 * TREPAN (Craven & Shavlik, NIPS 1995 / 1996): learn a decision tree that
 * imitates a model, using the model as an oracle.
 *
 * - The oracle labels the training cases, and also made-up "query" cases drawn
 *   from each feature's distribution in the training data, constrained to reach
 *   the node being split. So every split is chosen from at least `sMin` cases,
 *   however deep the node.
 * - Nodes are expanded best-first by reach × (1 − fidelity): where the most cases
 *   meet the most disagreement with the model.
 * - A node stays a leaf when, with high confidence, it covers only one class.
 * - Optionally, splits are m-of-n tests found by hill climbing.
 */
export interface TrepanOptions {
  /** Size limit, in internal nodes (the paper used 15). */
  maxInternal?: number;
  /** Cases (training + queries) considered before choosing a split (the paper used 1000). */
  sMin?: number;
  /** Stopping test: leaf if P(majority share < 1 − epsilon) < delta. */
  epsilon?: number;
  delta?: number;
  /** Ask the oracle about made-up cases (true), or use only the training cases (false). */
  queries?: boolean;
  /** Allow m-of-n splits on categorical features. */
  mofn?: boolean;
  seed?: number;
}

export type TrepanEvent = {
  kind: 'expand';
  node: number;
  test: Test;
  /** The made-up cases generated to decide this split. */
  queries: Instance[];
  /** Training cases that reached the node. */
  examples: number;
  reach: number;
  fidelity: number;
  internal: number;
};

interface Pending {
  node: TreeNode;
  examples: Instance[];
  path: Test[];
  reach: number;
  /** Cases (examples + queries) and their oracle labels, used to judge the node. */
  cases: Instance[];
  labels: number[];
  queries: Instance[];
}

export function trepan(features: readonly Feature[], X: readonly Instance[], oracle: Labeler, options: TrepanOptions = {}, emit?: (e: TrepanEvent) => void): DecisionTree {
  const { maxInternal = 15, sMin = 200, epsilon = 0.05, delta = 0.05, queries = true, mofn = false, seed = 1 } = options;
  const rng = new Random(seed);
  const sampler = makeSampler(features, X);
  let nextId = 0;

  /** The node's cases: its training examples plus, if allowed, queries up to sMin. */
  const gather = (examples: Instance[], path: Test[]) => {
    const made: Instance[] = [];
    if (queries) {
      let attempts = 0;
      while (examples.length + made.length < sMin && attempts < sMin * 3) {
        attempts++;
        const q = sampler(rng, path);
        if (q) made.push(q);
      }
    }
    const cases = [...examples, ...made];
    return { cases, labels: cases.map((x) => oracle(x)), queries: made };
  };

  const makePending = (examples: Instance[], path: Test[], reach: number, depth: number): Pending => {
    const { cases, labels, queries: made } = gather(examples, path);
    const counts: [number, number] = [0, 0];
    for (const l of labels) counts[l]++;
    return { node: { id: nextId++, depth, counts, n: cases.length }, examples, path, reach, cases, labels, queries: made };
  };

  /** The stopping test: confident that this node covers a single class. */
  const isPure = (p: Pending) => {
    const n = p.cases.length;
    if (n === 0) return true;
    const majority = Math.max(p.node.counts[0], p.node.counts[1]) / n;
    if (majority === 1) return true;
    const z = normalQuantile(1 - delta);
    return majority - z * Math.sqrt((majority * (1 - majority)) / n) > 1 - epsilon;
  };

  const fidelityOf = (p: Pending) => (p.cases.length ? Math.max(p.node.counts[0], p.node.counts[1]) / p.cases.length : 1);

  const root = makePending([...X], [], 1, 0);
  const queue: Pending[] = isPure(root) ? [] : [root];
  let internal = 0;

  while (queue.length > 0 && internal < maxInternal) {
    // Best first: the node where the tree loses the most fidelity.
    let pick = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i];
      const b = queue[pick];
      const fa = a.reach * (1 - fidelityOf(a));
      const fb = b.reach * (1 - fidelityOf(b));
      if (fa > fb + 1e-12 || (Math.abs(fa - fb) <= 1e-12 && a.node.id < b.node.id)) pick = i;
    }
    const [p] = queue.splice(pick, 1);
    const split = bestSplit(features, p.cases, p.labels, mofn);
    if (!split) continue;

    p.node.test = split;
    internal++;
    emit?.({ kind: 'expand', node: p.node.id, test: split, queries: p.queries, examples: p.examples.length, reach: p.reach, fidelity: fidelityOf(p), internal });

    const share = p.cases.length ? p.cases.filter((x) => holds(split, x)).length / p.cases.length : 0.5;
    const yes = makePending(
      p.examples.filter((x) => holds(split, x)),
      [...p.path, split],
      p.reach * share,
      p.node.depth + 1,
    );
    const no = makePending(
      p.examples.filter((x) => !holds(split, x)),
      [...p.path, negate(split)],
      p.reach * (1 - share),
      p.node.depth + 1,
    );
    p.node.yes = yes.node;
    p.node.no = no.node;
    for (const child of [yes, no]) if (!isPure(child) && child.cases.length >= 2) queue.push(child);
  }

  return new DecisionTree(root.node, features);
}

/* ---------------- choosing a split ---------------- */

function entropy(counts: readonly number[]): number {
  const total = counts.reduce((s, c) => s + c, 0);
  let h = 0;
  for (const c of counts) if (c > 0) h -= (c / total) * Math.log2(c / total);
  return h;
}

/** Information gain of a split, and C4.5's gain ratio (gain divided by the split's own entropy). */
export function splitScores(test: Test, cases: readonly Instance[], labels: readonly number[]): { gain: number; ratio: number } {
  const yes = [0, 0];
  const no = [0, 0];
  cases.forEach((x, i) => (holds(test, x) ? yes : no)[labels[i]]++);
  const nYes = yes[0] + yes[1];
  const nNo = no[0] + no[1];
  const n = nYes + nNo;
  if (nYes === 0 || nNo === 0) return { gain: 0, ratio: 0 };
  const gain = entropy([yes[0] + no[0], yes[1] + no[1]]) - (nYes / n) * entropy(yes) - (nNo / n) * entropy(no);
  const splitInfo = entropy([nYes, nNo]);
  return { gain, ratio: splitInfo > 0 ? gain / splitInfo : 0 };
}

export function gainRatio(test: Test, cases: readonly Instance[], labels: readonly number[]): number {
  return splitScores(test, cases, labels).ratio;
}

/**
 * The best single test, as C4.5 (and so TREPAN) picks it: the highest gain ratio
 * among tests whose information gain is at least average. The average-gain
 * filter stops the ratio from favouring lopsided splits that cut off a sliver.
 */
function bestSplit(features: readonly Feature[], cases: readonly Instance[], labels: readonly number[], mofn: boolean): Test | null {
  const rows = cases.map((_, i) => i);
  const scored: { test: Test; gain: number; ratio: number }[] = [];
  features.forEach((f, index) => {
    for (const test of candidateTests(f, index, cases, rows)) {
      const s = splitScores(test, cases, labels);
      if (s.gain > 1e-12) scored.push({ test, ...s });
    }
  });
  if (scored.length === 0) return null;
  const averageGain = scored.reduce((sum, s) => sum + s.gain, 0) / scored.length;
  let best = scored[0];
  for (const s of scored) if (s.gain >= averageGain - 1e-12 && (best.gain < averageGain - 1e-12 || s.ratio > best.ratio + 1e-12)) best = s;
  if (!mofn) return best.test;
  return mOfNSearch(features, cases, labels, best.test, best.ratio);
}

/**
 * Hill climbing from the best single test, with the paper's two operators:
 * m-of-n → m-of-(n+1) (add a condition), and m-of-n → (m+1)-of-(n+1) (add a
 * condition and raise the threshold). Conditions are "feature = value" tests on
 * categorical features not already in the set.
 */
function mOfNSearch(features: readonly Feature[], cases: readonly Instance[], labels: readonly number[], seed: Test, seedScore: number): Test {
  if (seed.kind !== 'cat') return seed;
  const pool: Test[] = [];
  features.forEach((f, index) => {
    if (f.kind !== 'categorical') return;
    f.values.forEach((_, value) => pool.push({ kind: 'cat', feature: index, value, equal: true }));
  });
  let current: { m: number; tests: Test[]; score: number } = { m: 1, tests: [seed], score: seedScore };
  for (;;) {
    let improved: typeof current | null = null;
    for (const add of pool) {
      if (add.kind !== 'cat' || current.tests.some((t) => t.kind === 'cat' && t.feature === add.feature)) continue;
      for (const m of [current.m, current.m + 1]) {
        const tests = [...current.tests, add];
        const test: Test = { kind: 'mofn', m, tests, atLeast: true };
        const score = gainRatio(test, cases, labels);
        if (score > (improved?.score ?? current.score) + 1e-9) improved = { m, tests, score };
      }
    }
    if (!improved) break;
    current = improved;
  }
  return current.tests.length === 1 ? current.tests[0] : { kind: 'mofn', m: current.m, tests: current.tests, atLeast: true };
}

/* ---------------- made-up cases ---------------- */

/**
 * Draws a case from the training data's per-feature distributions (frequency
 * counts for categorical features, a kernel density estimate for numeric ones),
 * respecting the single-feature constraints on the path, then checks the whole
 * path (needed for m-of-n tests). Returns null if it can't find one.
 */
export function makeSampler(features: readonly Feature[], X: readonly Instance[]): (rng: Random, path: readonly Test[]) => Instance | null {
  const columns = features.map((_, f) => X.map((x) => x[f]));
  const bandwidth = features.map((f, i) => {
    if (f.kind !== 'numeric') return 0;
    const v = columns[i];
    const mean = v.reduce((s, x) => s + x, 0) / Math.max(1, v.length);
    const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, v.length)) || (f.max - f.min) / 4;
    return 1.06 * sd * Math.max(1, v.length) ** -0.2; // Silverman's rule of thumb
  });

  return (rng, path) => {
    // Single-feature constraints: intervals for numbers, allowed values for categories.
    const lo = features.map((f) => (f.kind === 'numeric' ? f.min : 0));
    const hi = features.map((f) => (f.kind === 'numeric' ? f.max : 0));
    const allowed = features.map((f) => (f.kind === 'categorical' ? new Set(f.values.map((_, v) => v)) : null));
    for (const t of path) {
      if (t.kind === 'num') {
        if (t.above) lo[t.feature] = Math.max(lo[t.feature], t.threshold);
        else hi[t.feature] = Math.min(hi[t.feature], t.threshold);
      } else if (t.kind === 'cat') {
        const set = allowed[t.feature]!;
        if (t.equal) {
          for (const v of [...set]) if (v !== t.value) set.delete(v);
        } else set.delete(t.value);
      }
    }
    if (allowed.some((s) => s && s.size === 0) || features.some((f, i) => f.kind === 'numeric' && lo[i] >= hi[i])) return null;

    for (let attempt = 0; attempt < 100; attempt++) {
      const x = features.map((f, i) => {
        if (f.kind === 'numeric') {
          for (let tries = 0; tries < 30; tries++) {
            const v = columns[i][rng.int(columns[i].length)] + rng.normal() * bandwidth[i];
            if (v >= lo[i] && v < hi[i]) return v;
          }
          return rng.uniform(lo[i], hi[i]);
        }
        const options = [...allowed[i]!];
        const weights = options.map((v) => columns[i].filter((c) => c === v).length + 0.5);
        let r = rng.next() * weights.reduce((s, w) => s + w, 0);
        for (let k = 0; k < options.length; k++) {
          r -= weights[k];
          if (r <= 0) return options[k];
        }
        return options[options.length - 1];
      });
      if (path.every((t) => holds(t, x))) return x;
    }
    return null;
  };
}

/** Inverse of the standard normal CDF (Acklam's approximation), for the stopping test. */
export function normalQuantile(p: number): number {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const q = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  if (q < 0.02425) {
    const r = Math.sqrt(-2 * Math.log(q));
    return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1);
  }
  if (q > 1 - 0.02425) return -normalQuantile(1 - q);
  const r = q - 0.5;
  const s = r * r;
  return ((((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r) / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1);
}

/**
 * The tree as it was after its first `steps` expansions (`order` lists node ids
 * in the order they were split), for stepping through the growth.
 */
export function treeAfter(tree: DecisionTree, order: readonly number[], steps: number): DecisionTree {
  const allowed = new Set(order.slice(0, steps));
  const copy = (node: TreeNode): TreeNode =>
    node.test && allowed.has(node.id) ? { ...node, yes: copy(node.yes!), no: copy(node.no!) } : { id: node.id, depth: node.depth, counts: node.counts, n: node.n };
  return new DecisionTree(copy(tree.root), tree.features);
}
