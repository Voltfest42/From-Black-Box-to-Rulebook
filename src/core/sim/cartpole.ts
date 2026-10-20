import type { NumericFeature } from '../data/dataset';
import { Random } from '../random';

/**
 * The classic cart-pole balancing task (Barto, Sutton & Anderson, 1983), with
 * the constants and Euler steps of the standard CartPole-v1 benchmark: push the
 * cart left or right, keep the pole upright and the cart on the track.
 */
export type CartState = readonly [x: number, speed: number, angle: number, spin: number];

export const LEFT = 0;
export const RIGHT = 1;

export const MAX_STEPS = 500;
export const TRACK_LIMIT = 2.4;
export const ANGLE_LIMIT = (12 * Math.PI) / 180;

const GRAVITY = 9.8;
const CART_MASS = 1.0;
const POLE_MASS = 0.1;
const TOTAL_MASS = CART_MASS + POLE_MASS;
const HALF_LENGTH = 0.5;
const POLE_MOMENT = POLE_MASS * HALF_LENGTH;
const FORCE = 10;
const TAU = 0.02;

/** The four numbers the agent sees, in readable units, as features for trees and rules. */
export const CART_FEATURES: readonly NumericFeature[] = [
  { kind: 'numeric', name: 'cart position', min: -TRACK_LIMIT, max: TRACK_LIMIT, unit: 'm', decimals: 2 },
  { kind: 'numeric', name: 'cart speed', min: -3, max: 3, unit: 'm/s', decimals: 2 },
  { kind: 'numeric', name: 'pole angle', min: -12, max: 12, unit: '°', decimals: 2 },
  { kind: 'numeric', name: 'pole spin', min: -200, max: 200, unit: '°/s', decimals: 0 },
];

const DEGREES = 180 / Math.PI;

/** A state in the units of CART_FEATURES: metres, metres per second, degrees, degrees per second. Positive angle: leaning right. */
export function features(s: CartState): number[] {
  return [s[0], s[1], s[2] * DEGREES, s[3] * DEGREES];
}

export function step(s: CartState, action: number): CartState {
  const [x, xDot, theta, thetaDot] = s;
  const force = action === RIGHT ? FORCE : -FORCE;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const temp = (force + POLE_MOMENT * thetaDot * thetaDot * sin) / TOTAL_MASS;
  const thetaAcc = (GRAVITY * sin - cos * temp) / (HALF_LENGTH * (4 / 3 - (POLE_MASS * cos * cos) / TOTAL_MASS));
  const xAcc = temp - (POLE_MOMENT * thetaAcc * cos) / TOTAL_MASS;
  return [x + TAU * xDot, xDot + TAU * xAcc, theta + TAU * thetaDot, thetaDot + TAU * thetaAcc];
}

export function failed(s: CartState): boolean {
  return Math.abs(s[0]) > TRACK_LIMIT || Math.abs(s[2]) > ANGLE_LIMIT;
}

/** A start state near upright, as in the benchmark. */
export function startState(rng: Random): CartState {
  return [rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05), rng.uniform(-0.05, 0.05)];
}

export type Policy = (s: CartState) => number;

/** Steps survived (up to MAX_STEPS) from a state, and the states visited. */
export function episode(policy: Policy, start: CartState, maxSteps = MAX_STEPS): { steps: number; states: CartState[] } {
  const states: CartState[] = [];
  let s = start;
  for (let t = 0; t < maxSteps; t++) {
    states.push(s);
    s = step(s, policy(s));
    if (failed(s)) return { steps: t + 1, states };
  }
  return { steps: maxSteps, states };
}

/** Mean steps survived over a few fixed start states. */
export function score(policy: Policy, episodes: number, seed: number, maxSteps = MAX_STEPS): number {
  const rng = new Random(seed);
  let total = 0;
  for (let e = 0; e < episodes; e++) total += episode(policy, startState(rng), maxSteps).steps;
  return total / episodes;
}

/** Scales a state to roughly [-1, 1] for a network. */
export function normalise(s: CartState): number[] {
  return [s[0] / TRACK_LIMIT, s[1] / 3, s[2] / ANGLE_LIMIT, s[3] / 3.5];
}
