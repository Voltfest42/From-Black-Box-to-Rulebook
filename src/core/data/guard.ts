import { Random } from '../random';
import type { ClassNames, Dataset, Instance, NumericFeature } from './dataset';

/**
 * "Will the guard spot you?" A stealth-game guard, from two features: how far
 * away you are and how bright it is. Two features means the whole decision can
 * be drawn as a map.
 */
export const DISTANCE = 0;
export const LIGHT = 1;

export const GUARD_FEATURES: readonly NumericFeature[] = [
  { kind: 'numeric', name: 'distance', min: 0, max: 20, unit: 'm', decimals: 1 },
  { kind: 'numeric', name: 'light', min: 0, max: 100, unit: '%', decimals: 0 },
];

export const GUARD_CLASSES: ClassNames = { yes: 'spotted', no: 'hidden' };

/** The guard hears anyone this close, whatever the light. */
export const HEARING_RANGE = 3;

/** How far the guard can see, in metres: 20 m in full light, shrinking in the dark. */
export function sightRange(light: number): number {
  return light / 5;
}

/**
 * The game's real logic, as its designer wrote it:
 * spotted if you're within hearing range, or within sight range for this light.
 */
export function guardRule(x: Instance): boolean {
  return x[DISTANCE] < Math.max(HEARING_RANGE, sightRange(x[LIGHT]));
}

export const GUARD_RULE_TEXT = `spotted if you're closer than ${HEARING_RANGE} m (the guard hears you), or closer than light ÷ 5 metres (the guard sees you: 20 m in full light, 4 m at 20% light)`;

/** How far inside (positive) or outside (negative) the guard's range a case is, in metres. */
export function guardMargin(x: Instance): number {
  return Math.max(HEARING_RANGE, sightRange(x[LIGHT])) - x[DISTANCE];
}

export interface GuardLogOptions {
  /** Number of log entries. */
  size?: number;
  /** Fraction of entries recorded with the wrong outcome, anywhere on the map. */
  flips?: number;
  /** Near the edge of the guard's range the outcome is a coin flip; this is how wide (m) that fuzzy edge is. */
  fuzz?: number;
  seed?: number;
}

/**
 * "Playtest logs": positions sampled uniformly over the map, labelled by the
 * game's logic but noisily, the way real logs are (lag, a second guard, a
 * player who got lucky at the edge of the light).
 */
export function guardLogs({ size = 240, flips = 0.04, fuzz = 0.8, seed = 1 }: GuardLogOptions = {}): Dataset {
  const rng = new Random(seed);
  const X: Instance[] = [];
  const y: number[] = [];
  for (let i = 0; i < size; i++) {
    const x = [round(rng.uniform(0, 20), 2), round(rng.uniform(0, 100), 1)];
    const pSpotted = fuzz > 0 ? 1 / (1 + Math.exp(-guardMargin(x) / (fuzz / 4))) : guardRule(x) ? 1 : 0;
    let label = rng.next() < pSpotted ? 1 : 0;
    if (rng.next() < flips) label = 1 - label;
    X.push(x);
    y.push(label);
  }
  return { features: GUARD_FEATURES, X, y };
}

/**
 * A regular grid of points over the whole map, for measuring a model or a rule
 * by area: "the rules agree with the network on 96% of the map".
 */
export function guardGrid(columns = 80, rows = 80): Instance[] {
  const points: Instance[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) points.push([((c + 0.5) / columns) * 20, ((r + 0.5) / rows) * 100]);
  }
  return points;
}

function round(x: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(x * f) / f;
}
