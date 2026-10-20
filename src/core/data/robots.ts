import { Random } from '../random';
import { enumerateInstances, type CategoricalFeature, type ClassNames, type Dataset, type Instance } from './dataset';

/**
 * The robots of the MONK's problems (Thrun et al., 1991): a classic benchmark
 * for rule learners, chosen because the rule behind the labels is known.
 * Six traits, 3 × 3 × 2 × 3 × 4 × 2 = 432 possible robots.
 */
const SHAPE_VALUES = ['round', 'square', 'octagon'];
const JACKET_VALUES = ['red', 'yellow', 'green', 'blue'];
const HELD_VALUES = ['sword', 'balloon', 'flag'];

export const ROBOT_FEATURES: readonly CategoricalFeature[] = [
  {
    kind: 'categorical',
    name: 'head',
    values: SHAPE_VALUES,
    describe: (v, equal) => `head is ${equal ? '' : 'not '}${SHAPE_VALUES[v]}`,
  },
  {
    kind: 'categorical',
    name: 'body',
    values: SHAPE_VALUES,
    describe: (v, equal) => `body is ${equal ? '' : 'not '}${SHAPE_VALUES[v]}`,
  },
  {
    kind: 'categorical',
    name: 'smiling',
    values: ['yes', 'no'],
    describe: (v, equal) => ((v === 0) === equal ? 'smiling' : 'not smiling'),
  },
  {
    kind: 'categorical',
    name: 'holding',
    values: HELD_VALUES,
    describe: (v, equal) => `${equal ? 'holds' : 'no'} ${HELD_VALUES[v]}`,
  },
  {
    kind: 'categorical',
    name: 'jacket',
    values: JACKET_VALUES,
    describe: (v, equal) => `jacket is ${equal ? '' : 'not '}${JACKET_VALUES[v]}`,
  },
  {
    kind: 'categorical',
    name: 'tie',
    values: ['yes', 'no'],
    describe: (v, equal) => ((v === 0) === equal ? 'has a tie' : 'no tie'),
  },
];

/** Indices into a robot instance. */
export const HEAD = 0;
export const BODY = 1;
export const SMILING = 2;
export const HOLDING = 3;
export const JACKET = 4;
export const TIE = 5;

export const SHAPES = { round: 0, square: 1, octagon: 2 } as const;
export const HELD = { sword: 0, balloon: 1, flag: 2 } as const;
export const JACKETS = { red: 0, yellow: 1, green: 2, blue: 3 } as const;
export const YES = 0;
export const NO = 1;

export interface Robot {
  head: number;
  body: number;
  smiling: boolean;
  holding: number;
  jacket: number;
  tie: boolean;
}

export function toRobot(x: Instance): Robot {
  return { head: x[HEAD], body: x[BODY], smiling: x[SMILING] === YES, holding: x[HOLDING], jacket: x[JACKET], tie: x[TIE] === YES };
}

/** All 432 robots, in a fixed order (head varies slowest, tie fastest). */
export const ALL_ROBOTS: readonly Instance[] = enumerateInstances(ROBOT_FEATURES);

export type MonkProblem = 1 | 2 | 3;

export const ROBOT_CLASSES: ClassNames = { yes: 'friendly', no: 'not friendly' };

/** The hidden rules, exactly as in the 1991 report (traits numbered a1–a6, values from 1). */
export const MONK_RULES: Record<MonkProblem, (x: Instance) => boolean> = {
  // MONK-1: (a1 = a2) or (a5 = 1)
  1: (x) => x[HEAD] === x[BODY] || x[JACKET] === JACKETS.red,
  // MONK-2: exactly two of the six traits have their first value
  2: (x) => x.filter((v) => v === 0).length === 2,
  // MONK-3: (a5 = 3 and a4 = 1) or (a5 ≠ 4 and a2 ≠ 3)
  3: (x) =>
    (x[JACKET] === JACKETS.green && x[HOLDING] === HELD.sword) ||
    (x[JACKET] !== JACKETS.blue && x[BODY] !== SHAPES.octagon),
};

/** The hidden rules in words, for the reveal. */
export const MONK_RULE_TEXT: Record<MonkProblem, string> = {
  1: 'the head and body have the same shape, or the jacket is red',
  2: 'exactly two of the six traits have their first value (round head, round body, smiling, sword, red jacket, tie)',
  3: 'the jacket is green and it holds a sword, or the jacket is not blue and the body is not an octagon',
};

/** Training-set sizes and label noise of the original benchmark. */
const TRAINING = {
  1: { size: 124, noise: 0 },
  2: { size: 169, noise: 0 },
  3: { size: 122, noise: 0.05 },
} as const;

export function monkLabel(problem: MonkProblem, x: Instance): number {
  return MONK_RULES[problem](x) ? 1 : 0;
}

/** The true label of every robot, in ALL_ROBOTS order. */
export function monkTruth(problem: MonkProblem): number[] {
  return ALL_ROBOTS.map((x) => monkLabel(problem, x));
}

/**
 * A training set like the original: the same size, drawn at random from the
 * 432 robots (our own draw, seeded), with 5% of labels flipped for MONK-3.
 * `indices` are positions in ALL_ROBOTS.
 */
export function monkTrainingSet(problem: MonkProblem, seed = 1): Dataset & { indices: number[]; flipped: number[] } {
  const rng = new Random(seed * 1000 + problem);
  const { size, noise } = TRAINING[problem];
  const indices = rng.sample(
    ALL_ROBOTS.map((_, i) => i),
    size,
  );
  indices.sort((a, b) => a - b);
  const X = indices.map((i) => ALL_ROBOTS[i]);
  const y = X.map((x) => monkLabel(problem, x));
  const flipped: number[] = [];
  if (noise > 0) {
    const flips = Math.round(noise * size);
    for (const j of rng.sample(
      y.map((_, j) => j),
      flips,
    )) {
      y[j] = 1 - y[j];
      flipped.push(indices[j]);
    }
  }
  return { features: ROBOT_FEATURES, X, y, indices, flipped: flipped.sort((a, b) => a - b) };
}

/** Position of a robot in ALL_ROBOTS. */
export function robotIndex(x: Instance): number {
  let index = 0;
  for (let i = 0; i < ROBOT_FEATURES.length; i++) index = index * ROBOT_FEATURES[i].values.length + x[i];
  return index;
}
