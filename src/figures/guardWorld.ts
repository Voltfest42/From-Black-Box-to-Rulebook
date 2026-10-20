import type { Dataset, Instance } from '../core/data/dataset';
import { guardGrid, guardLogs, guardRule, GUARD_FEATURES } from '../core/data/guard';
import { trainNetwork, type BlackBox } from '../core/models/blackbox';
import { agreement, labelAll, type Labeler } from '../core/rules/metrics';
import { computeField, type Field } from '../viz/map/field';

/** The two guard features, typed as a pair for the map. */
export const MAP_FEATURES = [GUARD_FEATURES[0], GUARD_FEATURES[1]] as const;

/** An even grid over the whole map: fidelity and accuracy are shares of its area. */
export const GRID: readonly Instance[] = guardGrid(60, 60);
export const GRID_TRUTH: readonly number[] = GRID.map((x) => (guardRule(x) ? 1 : 0));

export interface GuardWorld {
  logs: Dataset;
  box: BlackBox;
  field: Field;
  /** The network's label for every grid point. */
  gridLabels: number[];
  /** Share of the map where the network matches the game's real logic. */
  accuracy: number;
}

const cache = new Map<string, GuardWorld>();

/**
 * Playtest logs and a neural network trained on them: the black box for the
 * guard figures. Cached, so figures sharing settings share one network.
 */
export function guardWorld({ size = 60, flips = 0.04, seed = 1 }: { size?: number; flips?: number; seed?: number } = {}): GuardWorld {
  const key = `${size}-${flips}-${seed}`;
  let world = cache.get(key);
  if (!world) {
    const logs = guardLogs({ size, flips, seed });
    const { box } = trainNetwork(logs, { hidden: [12, 12], epochs: 500, seed: 1 });
    const gridLabels = labelAll(box.label, GRID);
    world = { logs, box, field: computeField(box.proba, MAP_FEATURES), gridLabels, accuracy: agreement(gridLabels, GRID_TRUTH) };
    cache.set(key, world);
  }
  return world;
}

/** Fidelity to the network and accuracy against the game, both as shares of the map. */
export function scoreOnMap(label: Labeler, world: GuardWorld): { fidelity: number; accuracy: number } {
  const labels = labelAll(label, GRID);
  return { fidelity: agreement(labels, world.gridLabels), accuracy: agreement(labels, GRID_TRUTH) };
}
