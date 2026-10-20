import type { Instance, NumericFeature } from '../data/dataset';
import { GUARD_FEATURES, guardRule } from '../data/guard';
import { randomForest, type Forest } from '../models/forest';
import { Random } from '../random';

/**
 * The "scaffolding" attack of Slack, Hilgard, Jia, Singh & Lakkaraju (AIES
 * 2020), on the guard. The rigged model is biased on real cases, but wraps
 * itself in a detector that spots the made-up cases explainers ask about, and
 * answers those with an innocent model instead.
 *
 * In real play the level's torches sit by the guard, so the light depends on
 * the distance: real logs lie in a band. LIME varies distance and light
 * separately, so many of its questions fall outside the band.
 */
export const RIGGED_FEATURES: readonly NumericFeature[] = [
  ...GUARD_FEATURES,
  { kind: 'numeric', name: 'free skin', min: 0, max: 1, decimals: 0 },
];

/** Feature index: 1 if the player wears the free skin, 0 for the paid one. */
export const FREE_SKIN = 2;

/** The light where real players stand, by distance from the guard (the torches are by the guard). */
export function torchLight(distance: number): number {
  return 80 * Math.exp(-distance / 9);
}

const BAND_NOISE = 4;
const clampLight = (l: number) => Math.min(100, Math.max(0, l));
const clampDistance = (d: number) => Math.min(20, Math.max(0, d));

/** A position where a real player might stand. */
export function realLog(rng: Random): Instance {
  const d = rng.uniform(0, 20);
  return [d, clampLight(torchLight(d) + rng.normal() * BAND_NOISE), rng.bernoulli(0.5) ? 1 : 0];
}

/** LIME's question about a case near x: each feature varied on its own (skin drawn 50/50, as LIME does for categories). */
export function madeUpNear(rng: Random, x: Instance, spread: number): Instance {
  return [clampDistance(x[0] + rng.normal() * spread * 20), clampLight(x[1] + rng.normal() * spread * 100), rng.bernoulli(0.5) ? 1 : 0];
}

/**
 * A realistic question near x: a position a real player could have, from the
 * game's own log generator. It stands in for the generative model that
 * Saito et al. (2020) trained to make LIME's questions realistic.
 */
export function realisticNear(rng: Random, x: Instance, spread: number): Instance {
  const d = clampDistance(x[0] + rng.normal() * spread * 20);
  return [d, clampLight(torchLight(d) + rng.normal() * BAND_NOISE), rng.bernoulli(0.5) ? 1 : 0];
}

/** What the rigged guard does to real players: it sees free-skin players from twice as far. */
export function biasedGuard(x: Instance): number {
  const range = Math.max(3, x[1] / 5) * (x[FREE_SKIN] === 1 ? 2 : 1);
  return x[0] < range ? 1 : 0;
}

/** The innocent model it shows to questions it thinks are made up: the designer's rule, ignoring the skin. */
export function innocentGuard(x: Instance): number {
  return guardRule(x) ? 1 : 0;
}

export interface RiggedGuard {
  detector: Forest;
  /** Does this look like a real player's position? */
  looksReal: (x: Instance) => boolean;
  /** The deployed model: biased on cases that look real, innocent otherwise. */
  answer: (x: Instance) => number;
}

/** Trains the detector on real logs against LIME-style questions about them, then wraps the two models. */
export function rigGuard({ cases = 1500, spread = 0.25, threshold = 0.7, seed = 1 } = {}): RiggedGuard {
  const rng = new Random(seed);
  const real = Array.from({ length: cases }, () => realLog(rng));
  const fake = real.map((x) => madeUpNear(rng, x, spread));
  const detector = randomForest(RIGGED_FEATURES, [...real, ...fake], [...real.map(() => 1), ...fake.map(() => 0)], { trees: 40, maxDepth: 10, seed });
  const looksReal = (x: Instance) => detector.proba(x) >= threshold;
  return { detector, looksReal, answer: (x) => (looksReal(x) ? biasedGuard(x) : innocentGuard(x)) };
}
