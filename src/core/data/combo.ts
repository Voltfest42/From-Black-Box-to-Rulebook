import { Random } from '../random';

/**
 * A fighting-game input buffer: a stream of button presses, and a detector that
 * should fire the moment the special move ↓ → P is completed.
 */
export const COMBO_SYMBOLS = ['↓', '→', 'P'] as const;
export const DOWN = 0;
export const FORWARD = 1;
export const PUNCH = 2;
export const COMBO = [DOWN, FORWARD, PUNCH];

/** The ideal answer: fire when the last three presses are ↓ → P. */
export function comboTargets(sequence: readonly number[]): number[] {
  return sequence.map((_, t) => (t >= 2 && sequence[t - 2] === DOWN && sequence[t - 1] === FORWARD && sequence[t] === PUNCH ? 1 : 0));
}

/**
 * The 4-state machine a game developer would write by hand. States: 0 nothing
 * useful yet, 1 just pressed ↓, 2 pressed ↓ →, 3 the move fired.
 */
export const COMBO_MACHINE = {
  start: 0,
  next: [
    [1, 0, 0],
    [1, 2, 0],
    [1, 0, 3],
    [1, 0, 0],
  ],
  output: [0, 0, 0, 1],
} as const;

/** Uniformly random presses. */
export function randomPresses(rng: Random, length: number): number[] {
  return Array.from({ length }, () => rng.int(3));
}

/**
 * Practice sessions for training: random presses with the move, and near
 * misses of it (↓ P, ↓ ↓ →, ↓ → → P), mixed in, so both outcomes are common.
 */
export function practiceSessions(count: number, length: number, seed: number): number[][] {
  const rng = new Random(seed);
  const pieces = [[DOWN, FORWARD, PUNCH], [DOWN, FORWARD, PUNCH], [DOWN, PUNCH], [DOWN, DOWN, FORWARD], [DOWN, FORWARD, FORWARD, PUNCH], [FORWARD, PUNCH]];
  return Array.from({ length: count }, () => {
    const seq: number[] = [];
    while (seq.length < length) {
      if (rng.next() < 0.45) seq.push(...rng.pick(pieces));
      else seq.push(rng.int(3));
    }
    return seq.slice(0, length);
  });
}
