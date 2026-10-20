import type { ClassNames, Dataset, Feature, Instance, NumericFeature } from '../core/data/dataset';
import { GUARD_CLASSES, GUARD_FEATURES, guardLogs } from '../core/data/guard';
import { ALL_ROBOTS, monkTrainingSet, monkTruth, ROBOT_CLASSES, ROBOT_FEATURES, type MonkProblem } from '../core/data/robots';
import { TOY_FEATURES, toyDataset, type ToyName } from '../core/data/toy2d';
import { anchors, type Candidate } from '../core/extract/anchors';
import { lime, type LimeResult } from '../core/extract/lime';
import { lore, type LoreResult } from '../core/extract/lore';
import { ruleFitPath, ruleFitProba, type RuleFitStep } from '../core/extract/ruleEnsembles';
import { trepan } from '../core/extract/trepan';
import { trainNetwork } from '../core/models/blackbox';
import { forestRules, randomForest } from '../core/models/forest';
import { knn } from '../core/models/knn';
import { collapseTree, growTree, type DecisionTree } from '../core/models/tree';
import { agreement, labelAll } from '../core/rules/metrics';
import { formatTest, predictList, type Rule, type RuleList, type Test } from '../core/rules/rule';

export type DataChoice = 'guard' | ToyName | 'monk1' | 'monk2' | 'monk3';
export type ModelChoice = 'network' | 'forest' | 'knn';
export type MethodChoice = 'surrogate' | 'trepan' | 'rulefit' | 'corels' | 'lime' | 'lore' | 'anchors';

export const DATA_LABELS: Record<DataChoice, string> = {
  guard: 'The guard (240 logs)',
  moons: 'Two moons',
  spiral: 'Spirals',
  xor: 'Checkerboard',
  rings: 'Rings',
  monk1: 'Robots, Puzzle 1',
  monk3: 'Robots, Puzzle 2 (noisy)',
  monk2: 'Robots, Puzzle 3 (hard)',
};

export const MODEL_LABELS: Record<ModelChoice, string> = {
  network: 'Neural network',
  forest: 'Random forest (100 trees)',
  knn: 'Nearest neighbours',
};

export const METHOD_LABELS: Record<MethodChoice, string> = {
  surrogate: 'Surrogate tree (from the training data)',
  trepan: 'TREPAN (asks about made-up cases)',
  rulefit: 'RuleFit (rules + lasso)',
  corels: 'CORELS (the best short rule list)',
  lime: 'LIME (one point: a straight line)',
  lore: 'LORE (one point: counterfactual rules)',
  anchors: 'Anchors (one robot: a pinning rule)',
};

/** Which methods make sense for which data. */
export function methodsFor(data: DataChoice): MethodChoice[] {
  return isRobots(data) ? ['surrogate', 'trepan', 'rulefit', 'corels', 'anchors'] : ['surrogate', 'trepan', 'rulefit', 'lime', 'lore'];
}

export function isRobots(data: DataChoice): data is 'monk1' | 'monk2' | 'monk3' {
  return data.startsWith('monk');
}

export function isLocal(method: MethodChoice): boolean {
  return method === 'lime' || method === 'lore' || method === 'anchors';
}

export interface World {
  data: DataChoice;
  features: readonly Feature[];
  classes: ClassNames;
  train: Dataset;
  /** Fresh cases with true labels, for accuracy. */
  test: { X: readonly Instance[]; y: readonly number[] };
  /** Where fidelity is measured: a grid over the map, or all 432 robots. */
  probe: readonly Instance[];
}

export function makeWorld(data: DataChoice, seed: number): World {
  if (isRobots(data)) {
    const problem = Number(data.slice(4)) as MonkProblem;
    return { data, features: ROBOT_FEATURES, classes: ROBOT_CLASSES, train: monkTrainingSet(problem, seed), test: { X: ALL_ROBOTS, y: monkTruth(problem) }, probe: ALL_ROBOTS };
  }
  const features = (data === 'guard' ? GUARD_FEATURES : TOY_FEATURES) as readonly NumericFeature[];
  const train = data === 'guard' ? guardLogs({ size: 240, seed }) : toyDataset(data, 300, seed);
  const test = data === 'guard' ? guardLogs({ size: 1000, seed: seed + 100 }) : toyDataset(data, 1000, seed + 100);
  const [fx, fy] = features;
  const probe: Instance[] = [];
  for (let r = 0; r < 50; r++) for (let c = 0; c < 50; c++) probe.push([fx.min + ((c + 0.5) / 50) * (fx.max - fx.min), fy.min + ((r + 0.5) / 50) * (fy.max - fy.min)]);
  return { data, features, classes: data === 'guard' ? GUARD_CLASSES : { yes: 'orange', no: 'blue' }, train, test, probe };
}

export interface Model {
  proba: (x: Instance) => number;
  label: (x: Instance) => number;
  /** The model's labels on the probe set. */
  probeLabels: number[];
  accuracy: number;
}

export function trainModel(world: World, choice: ModelChoice, seed: number): Model {
  const robots = isRobots(world.data);
  let proba: (x: Instance) => number;
  if (choice === 'network') {
    proba = trainNetwork(world.train, robots ? { hidden: [6], epochs: 250, seed } : { hidden: [12, 12], epochs: 400, seed }).box.proba;
  } else if (choice === 'forest') {
    const forest = randomForest(world.features, world.train.X, world.train.y, { trees: 100, maxDepth: robots ? 5 : 6, seed });
    proba = (x) => forest.proba(x);
  } else {
    proba = knn(world.train, robots ? 3 : 7).proba;
  }
  const label = (x: Instance) => (proba(x) >= 0.5 ? 1 : 0);
  return { proba, label, probeLabels: labelAll(label, world.probe), accuracy: agreement(labelAll(label, world.test.X), world.test.y) };
}

export type Extraction =
  | { kind: 'tree'; tree: DecisionTree; rules: Rule[]; label: (x: Instance) => number }
  | { kind: 'rulefit'; rules: { tests: Test[]; weight: number }[]; label: (x: Instance) => number }
  | { kind: 'list'; list: RuleList; certified: boolean; label: (x: Instance) => number }
  | { kind: 'lime'; result: LimeResult; label: (x: Instance) => number }
  | { kind: 'lore'; result: LoreResult }
  | { kind: 'anchors'; anchor: Candidate | null; target: number };

/** CORELS needs a worker (it can take seconds), so the Lab runs it itself; this wraps its answer. */
export function listExtraction(list: RuleList, certified: boolean): Extraction {
  return { kind: 'list', list, certified, label: (x) => predictList(list, x) };
}

/**
 * Runs an extraction method on the black box (all but CORELS). `size` is the rule budget (leaves
 * or rules); `point` is the case for the local methods.
 */
export function extract(world: World, model: Model, method: MethodChoice, size: number, point: Instance, seed: number): Extraction {
  const X = world.train.X;
  if (method === 'corels') throw new Error('CORELS runs in a worker: see listExtraction');
  if (method === 'surrogate' || method === 'trepan') {
    const raw =
      method === 'surrogate'
        ? growTree(world.features, X, labelAll(model.label, X), { maxLeaves: size })
        : trepan(world.features, X, model.label, { maxInternal: Math.max(1, size - 1), sMin: 200, mofn: isRobots(world.data), seed });
    const tree = collapseTree(raw);
    return { kind: 'tree', tree, rules: tree.yesRules(), label: (x) => tree.predict(x) };
  }
  if (method === 'rulefit') {
    const modelLabels = labelAll(model.label, X);
    const forest = randomForest(world.features, X, modelLabels, { trees: 40, maxDepth: 3, seed });
    // Many trees grow the same rule; keep one copy of each.
    const seen = new Set<string>();
    const candidates = forestRules(forest, world.features).filter((r) => {
      const key = r.tests.map((t) => formatTest(t, world.features)).sort().join(' & ');
      return !seen.has(key) && Boolean(seen.add(key));
    });
    const path = ruleFitPath(candidates, X, modelLabels, 40, 0.002);
    // The lasso can add several rules at once, jumping past the budget. So also
    // try the next step, trimmed to its `size` heaviest rules, and keep whichever
    // agrees with the black box more often.
    const within = path.reduce((best, s, i) => (s.rules.length <= size ? i : best), 0);
    const options: RuleFitStep[] = [path[within]];
    if (within + 1 < path.length) {
      const next = path[within + 1];
      options.push({ ...next, rules: [...next.rules].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, size) });
    }
    const fit = (step: RuleFitStep) => agreement(labelAll((x) => (ruleFitProba(step, x) >= 0.5 ? 1 : 0), X), modelLabels);
    const best = options.reduce((a, b) => (fit(b) > fit(a) ? b : a));
    return { kind: 'rulefit', rules: best.rules, label: (x) => (ruleFitProba(best, x) >= 0.5 ? 1 : 0) };
  }
  if (method === 'lime') {
    const result = lime(model.proba, point, world.features as NumericFeature[], { kernelWidth: 0.15, spread: 0.15, seed });
    return { kind: 'lime', result, label: (x) => (result.intercept + result.weights.reduce((s, w, i) => s + w * x[i], 0) >= 0.5 ? 1 : 0) };
  }
  if (method === 'lore') return { kind: 'lore', result: lore(model.label, point, world.features as NumericFeature[], { seed }) };
  const { anchor } = anchors(model.label, point, world.features as never, { seed });
  return { kind: 'anchors', anchor, target: model.label(point) };
}

/** Fidelity (on the probe set) and accuracy (on fresh cases) of a global extraction. */
export function score(world: World, model: Model, label: (x: Instance) => number) {
  return {
    fidelity: agreement(labelAll(label, world.probe), model.probeLabels),
    accuracy: agreement(labelAll(label, world.test.X), world.test.y),
  };
}
