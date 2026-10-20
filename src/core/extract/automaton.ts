import type { Rnn } from '../models/rnn';
import { Random } from '../random';

/**
 * Turning a recurrent network into a finite-state machine, in the style of
 * Giles et al. (1992) and Omlin & Giles (1996): run the network, cluster the
 * hidden states it visits, read off the transitions between clusters, and
 * minimise the resulting machine.
 */

/** A Moore machine: the output depends on the state just entered. */
export interface Machine {
  start: number;
  /** next[state][symbol] */
  next: number[][];
  /** Output of each state (1 = fire). */
  output: number[];
}

export function runMachine(machine: Machine, sequence: readonly number[]): { states: number[]; outputs: number[] } {
  let s = machine.start;
  const states: number[] = [];
  const outputs: number[] = [];
  for (const symbol of sequence) {
    s = machine.next[s][symbol];
    states.push(s);
    outputs.push(machine.output[s]);
  }
  return { states, outputs };
}

/* ---------------- k-means ---------------- */

export function kMeans(points: readonly ArrayLike<number>[], k: number, seed = 1, iterations = 50): { centers: Float64Array[]; assignment: number[] } {
  const rng = new Random(seed);
  const dim = points[0].length;
  const dist2 = (a: ArrayLike<number>, b: ArrayLike<number>) => {
    let s = 0;
    for (let d = 0; d < dim; d++) s += (a[d] - b[d]) ** 2;
    return s;
  };
  // k-means++ start: spread the first centres out.
  const centers: Float64Array[] = [Float64Array.from(points[rng.int(points.length)])];
  while (centers.length < k) {
    const weights = points.map((p) => Math.min(...centers.map((c) => dist2(p, c))));
    const total = weights.reduce((s, w) => s + w, 0);
    if (total === 0) break;
    let r = rng.next() * total;
    let pick = 0;
    while (pick < points.length - 1 && r > weights[pick]) r -= weights[pick++];
    centers.push(Float64Array.from(points[pick]));
  }
  let assignment = points.map(() => 0);
  for (let it = 0; it < iterations; it++) {
    const next = points.map((p) => {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, j) => {
        const d = dist2(p, c);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      return best;
    });
    const changed = next.some((a, i) => a !== assignment[i]);
    assignment = next;
    centers.forEach((c, j) => {
      const members = points.filter((_, i) => assignment[i] === j);
      if (members.length === 0) return;
      for (let d = 0; d < dim; d++) c[d] = members.reduce((s, m) => s + m[d], 0) / members.length;
    });
    if (!changed && it > 0) break;
  }
  return { centers, assignment };
}

export function nearest(centers: readonly ArrayLike<number>[], p: ArrayLike<number>): number {
  let best = 0;
  let bestD = Infinity;
  centers.forEach((c, j) => {
    let d = 0;
    for (let k = 0; k < p.length; k++) d += (p[k] - c[k]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = j;
    }
  });
  return best;
}

/* ---------------- extraction ---------------- */

export interface Visited {
  /** Every hidden state seen, h₀ first. */
  states: Float64Array[];
  /** (from, symbol, to) as indices into `states`. */
  steps: { from: number; symbol: number; to: number }[];
  /** The network's decision (fire or not) in each state; h₀ has none (-1). */
  fired: number[];
}

/** Runs the network on some sequences and records where it goes. */
export function visit(rnn: Rnn, sequences: readonly number[][]): Visited {
  const states: Float64Array[] = [rnn.initialState()];
  const fired = [-1];
  const steps: Visited['steps'] = [];
  for (const seq of sequences) {
    let from = 0;
    let h: Float64Array = states[0];
    for (const symbol of seq) {
      h = rnn.step(h, symbol);
      states.push(h);
      fired.push(rnn.output(h) >= 0.5 ? 1 : 0);
      const to = states.length - 1;
      steps.push({ from, symbol, to });
      from = to;
    }
  }
  return { states, steps, fired };
}

export interface Extraction {
  /** Machine with one state per cluster (before minimisation). */
  raw: Machine;
  /** The same behaviour with the fewest states. */
  minimal: Machine;
  /** Cluster of every visited state. */
  assignment: number[];
  centers: Float64Array[];
  /** Raw state → minimal state. */
  merged: number[];
}

export function extractMachine(visited: Visited, k: number, symbols: number, seed = 1): Extraction {
  // h₀ always gets its own cluster: it's where every sequence starts.
  const rest = visited.states.slice(1);
  const { centers, assignment: restAssignment } = kMeans(rest, Math.max(1, k - 1), seed);
  const assignment = [0, ...restAssignment.map((a) => a + 1)];
  const allCenters = [visited.states[0], ...centers];
  const n = allCenters.length;

  // Majority vote for every transition and every output.
  const votes = Array.from({ length: n }, () => Array.from({ length: symbols }, () => new Map<number, number>()));
  for (const { from, symbol, to } of visited.steps) {
    const m = votes[assignment[from]][symbol];
    const target = assignment[to];
    m.set(target, (m.get(target) ?? 0) + 1);
  }
  const fireVotes = Array.from({ length: n }, () => [0, 0]);
  visited.fired.forEach((f, i) => {
    if (f >= 0) fireVotes[assignment[i]][f]++;
  });
  const next = votes.map((row, s) =>
    row.map((m) => {
      let best = s;
      let bestCount = 0;
      for (const [t, c] of m) if (c > bestCount || (c === bestCount && t < best)) [best, bestCount] = [t, c];
      // Never seen this move from this state: stay put (rare with enough data).
      return best;
    }),
  );
  const output = fireVotes.map(([no, yes]) => (yes > no ? 1 : 0));
  const raw: Machine = { start: 0, next, output };
  const { machine: minimal, merged } = minimise(raw, symbols);
  return { raw, minimal, assignment, centers: allCenters, merged };
}

/**
 * Moore-machine minimisation (partition refinement): start with states grouped
 * by output, and keep splitting groups whose members go to different groups on
 * some symbol. Unreachable states are dropped first.
 */
export function minimise(machine: Machine, symbols: number): { machine: Machine; merged: number[] } {
  const n = machine.next.length;
  const reachable = new Set<number>([machine.start]);
  const queue = [machine.start];
  while (queue.length) {
    const s = queue.shift()!;
    for (let a = 0; a < symbols; a++) {
      const t = machine.next[s][a];
      if (!reachable.has(t)) {
        reachable.add(t);
        queue.push(t);
      }
    }
  }
  const live = [...reachable].sort((a, b) => a - b);
  let group = new Map<number, number>(live.map((s) => [s, machine.output[s]]));
  for (;;) {
    const signature = (s: number) => [group.get(s), ...Array.from({ length: symbols }, (_, a) => group.get(machine.next[s][a]))].join(',');
    const ids = new Map<string, number>();
    const next = new Map<number, number>();
    for (const s of live) {
      const sig = signature(s);
      if (!ids.has(sig)) ids.set(sig, ids.size);
      next.set(s, ids.get(sig)!);
    }
    const stable = new Set(next.values()).size === new Set(group.values()).size;
    group = next;
    if (stable) break;
  }
  // Renumber so the start state is 0 and others follow in order of first reach.
  const order: number[] = [];
  const bfs = [machine.start];
  const seenGroups = new Set<number>();
  while (bfs.length) {
    const s = bfs.shift()!;
    const g = group.get(s)!;
    if (seenGroups.has(g)) continue;
    seenGroups.add(g);
    order.push(g);
    for (let a = 0; a < symbols; a++) bfs.push(machine.next[s][a]);
  }
  const index = new Map(order.map((g, i) => [g, i]));
  const representative = new Map<number, number>();
  for (const s of live) if (!representative.has(group.get(s)!)) representative.set(group.get(s)!, s);
  const minimal: Machine = {
    start: 0,
    next: order.map((g) => Array.from({ length: symbols }, (_, a) => index.get(group.get(machine.next[representative.get(g)!][a])!)!)),
    output: order.map((g) => machine.output[representative.get(g)!]),
  };
  const merged = Array.from({ length: n }, (_, s) => (group.has(s) ? index.get(group.get(s)!)! : -1));
  return { machine: minimal, merged };
}

/** Do two machines behave identically on every input? (Compare reachable state pairs.) */
export function equivalent(a: Machine, b: Machine, symbols: number): boolean {
  const seen = new Set<string>();
  const queue: [number, number][] = [[a.start, b.start]];
  let first = true;
  while (queue.length) {
    const [s, t] = queue.shift()!;
    const key = `${s},${t}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!first && a.output[s] !== b.output[t]) return false;
    first = false;
    for (let x = 0; x < symbols; x++) queue.push([a.next[s][x], b.next[t][x]]);
  }
  return true;
}

/** Share of individual decisions (one per press) on which the machine and the network agree. */
export function machineFidelity(machine: Machine, rnn: Rnn, sequences: readonly number[][]): { perPress: number; perSequence: number } {
  let agree = 0;
  let total = 0;
  let wholeSequences = 0;
  for (const seq of sequences) {
    const m = runMachine(machine, seq).outputs;
    const r = rnn.run(seq).outputs.map((p) => (p >= 0.5 ? 1 : 0));
    let all = true;
    m.forEach((o, i) => {
      total++;
      if (o === r[i]) agree++;
      else all = false;
    });
    if (all) wholeSequences++;
  }
  return { perPress: agree / Math.max(1, total), perSequence: wholeSequences / Math.max(1, sequences.length) };
}

/** First two principal components of some points (for drawing hidden states in 2D). */
export function pca2(points: readonly ArrayLike<number>[], seed = 1): (p: ArrayLike<number>) => [number, number] {
  const dim = points[0].length;
  const mean = new Float64Array(dim);
  for (const p of points) for (let d = 0; d < dim; d++) mean[d] += p[d] / points.length;
  const centered = points.map((p) => Float64Array.from({ length: dim }, (_, d) => p[d] - mean[d]));
  const cov = Array.from({ length: dim }, () => new Float64Array(dim));
  for (const p of centered) for (let i = 0; i < dim; i++) for (let j = 0; j < dim; j++) cov[i][j] += (p[i] * p[j]) / points.length;
  const rng = new Random(seed);
  const components: Float64Array[] = [];
  for (let c = 0; c < 2; c++) {
    let v = Float64Array.from({ length: dim }, () => rng.uniform(-1, 1));
    for (let it = 0; it < 200; it++) {
      const w = new Float64Array(dim);
      for (let i = 0; i < dim; i++) for (let j = 0; j < dim; j++) w[i] += cov[i][j] * v[j];
      for (const prev of components) {
        const dot = w.reduce((s, x, i) => s + x * prev[i], 0);
        for (let i = 0; i < dim; i++) w[i] -= dot * prev[i];
      }
      const norm = Math.hypot(...w) || 1;
      v = w.map((x) => x / norm);
    }
    components.push(v);
  }
  return (p) => {
    const q = Array.from({ length: dim }, (_, d) => p[d] - mean[d]);
    return [q.reduce((s, x, i) => s + x * components[0][i], 0), q.reduce((s, x, i) => s + x * components[1][i], 0)];
  };
}

/**
 * When `machine` behaves like `reference`, which reference state each of its
 * states plays the part of (from walking both machines side by side); null when
 * they behave differently.
 */
export function correspondence(machine: Machine, reference: Machine, symbols: number): number[] | null {
  if (!equivalent(machine, reference, symbols)) return null;
  const roles = new Array<number>(machine.output.length).fill(-1);
  const queue: [number, number][] = [[machine.start, reference.start]];
  while (queue.length) {
    const [s, r] = queue.shift()!;
    if (roles[s] !== -1) continue;
    roles[s] = r;
    for (let a = 0; a < symbols; a++) queue.push([machine.next[s][a], reference.next[r][a]]);
  }
  return roles;
}
