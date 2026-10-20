import { collapseTree, DecisionTree, growTree } from '../models/tree';
import { Random } from '../random';
import { CART_FEATURES, episode, failed, features, LEFT, RIGHT, score, startState, step, type CartState, type Policy } from '../sim/cartpole';

/**
 * VIPER (Bastani, Pu & Solar-Lezama, NeurIPS 2018): extract a decision-tree
 * policy from a neural agent by imitation learning.
 *
 * Round after round: let the current policy play (the network first, then the
 * trees), ask the network what it would have done in every state visited, and
 * weight each state by how much the choice matters there: the gap between the
 * best and worst action's value. Train a tree on everything collected so far,
 * and keep the tree that plays best.
 *
 * The paper reads action values from the agent's Q-function. Our agent is a
 * policy network without one, so values are estimated by rollouts: take the
 * action, then let the network play on for a fixed horizon.
 */
export interface ViperOptions {
  rounds?: number;
  episodesPerRound?: number;
  maxDepth?: number;
  horizon?: number;
  /** Keep at most this many states per round (sampled), to stay fast. */
  statesPerRound?: number;
  /** Ignore the action-value weights (plain imitation, called DAgger). */
  unweighted?: boolean;
  seed?: number;
}

export interface ViperRound {
  round: number;
  tree: DecisionTree;
  /** Mean steps balanced by this round's tree on test starts. */
  reward: number;
  /** States collected so far. */
  states: number;
  /** Share of the round's states where the tree picks the network's action. */
  agreement: number;
}

export interface ViperResult {
  rounds: ViperRound[];
  best: ViperRound;
}

export function treePolicy(tree: DecisionTree): Policy {
  return (s) => tree.predict(features(s));
}

/** How long the network survives after taking `action` in state s (up to `horizon` steps). */
function value(teacher: Policy, s: CartState, action: number, horizon: number): number {
  let state = step(s, action);
  if (failed(state)) return 0;
  for (let t = 1; t < horizon; t++) {
    state = step(state, teacher(state));
    if (failed(state)) return t;
  }
  return horizon;
}

/** VIPER one round at a time, so a figure can show each round as it finishes. */
export function* viperRounds(teacher: Policy, options: ViperOptions = {}): Generator<ViperRound> {
  const { rounds = 8, episodesPerRound = 8, maxDepth = 2, horizon = 200, statesPerRound = 1200, unweighted = false, seed = 1 } = options;
  const rng = new Random(seed);
  const X: number[][] = [];
  const y: number[] = [];
  const w: number[] = [];
  let policy = teacher;

  for (let round = 1; round <= rounds; round++) {
    // Play, and collect the states visited.
    let visited: CartState[] = [];
    for (let e = 0; e < episodesPerRound; e++) visited.push(...episode(policy, startState(rng)).states);
    if (visited.length > statesPerRound) visited = rng.sample(visited, statesPerRound);

    // Label each state with the network's choice, weighted by how much it matters.
    for (const s of visited) {
      X.push(features(s));
      y.push(teacher(s));
      // The +1 floor keeps every state in play: in easy states both actions survive the horizon.
      w.push(unweighted ? 1 : Math.abs(value(teacher, s, RIGHT, horizon) - value(teacher, s, LEFT, horizon)) + 1);
    }

    const tree = collapseTree(growTree(CART_FEATURES, X, y, { maxDepth, weights: w, minLeaf: 5 }));
    const treeFor = treePolicy(tree);
    const agreement = visited.filter((s) => treeFor(s) === teacher(s)).length / Math.max(1, visited.length);
    yield { round, tree, reward: score(treeFor, 20, 4242), states: X.length, agreement };
    policy = treeFor;
  }
}

export function viper(teacher: Policy, options: ViperOptions = {}): ViperResult {
  const rounds = [...viperRounds(teacher, options)];
  const best = rounds.reduce((a, b) => (b.reward > a.reward ? b : a));
  return { rounds, best };
}
