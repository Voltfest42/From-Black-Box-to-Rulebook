import { Random } from '../random';
import type { Dataset, Instance, NumericFeature } from './dataset';

/**
 * Classic two-feature toy datasets for the Lab. Each comes with a generator,
 * so a fresh test sample can be drawn to measure accuracy honestly.
 */
export const TOY_FEATURES: readonly NumericFeature[] = [
  { kind: 'numeric', name: 'x', min: -1.5, max: 1.5, decimals: 2, axisLabel: 'x →' },
  { kind: 'numeric', name: 'y', min: -1.5, max: 1.5, decimals: 2, axisLabel: 'y →' },
];

export type ToyName = 'moons' | 'spiral' | 'xor' | 'rings';

export const TOY_LABELS: Record<ToyName, string> = {
  moons: 'Two moons',
  spiral: 'Spirals',
  xor: 'Checkerboard (XOR)',
  rings: 'Rings',
};

/** One labelled point; `noise` shifts it by a Gaussian of that size. */
function point(name: ToyName, rng: Random, noise: number): { x: Instance; y: number } {
  const label = rng.bernoulli(0.5) ? 1 : 0;
  let px: number;
  let py: number;
  if (name === 'moons') {
    const t = rng.uniform(0, Math.PI);
    if (label === 1) [px, py] = [Math.cos(t) - 0.5, Math.sin(t) - 0.25];
    else [px, py] = [0.5 - Math.cos(t), 0.25 - Math.sin(t)];
  } else if (name === 'spiral') {
    const r = rng.uniform(0.1, 1.3);
    const t = r * 5.5 + (label === 1 ? 0 : Math.PI);
    [px, py] = [r * Math.cos(t), r * Math.sin(t)];
  } else if (name === 'xor') {
    [px, py] = [rng.uniform(-1.3, 1.3), rng.uniform(-1.3, 1.3)];
    return { x: [clamp(px + rng.normal() * noise), clamp(py + rng.normal() * noise)], y: px * py > 0 ? 1 : 0 };
  } else {
    const r = label === 1 ? rng.uniform(0, 0.55) : rng.uniform(0.75, 1.3);
    const t = rng.uniform(0, 2 * Math.PI);
    [px, py] = [r * Math.cos(t), r * Math.sin(t)];
  }
  return { x: [clamp(px + rng.normal() * noise), clamp(py + rng.normal() * noise)], y: label };
}

function clamp(v: number): number {
  return Math.max(-1.5, Math.min(1.5, v));
}

export function toyDataset(name: ToyName, size: number, seed: number, noise = 0.1): Dataset {
  const rng = new Random(seed * 7 + name.length);
  const points = Array.from({ length: size }, () => point(name, rng, noise));
  return { features: TOY_FEATURES, X: points.map((p) => p.x), y: points.map((p) => p.y) };
}
