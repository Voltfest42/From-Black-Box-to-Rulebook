/**
 * Reading rules off a single neuron with yes/no inputs: the subset search of
 * Saito & Nakano (1988) and Fu's KT (1991), and Towell & Shavlik's M-of-N
 * simplification (1993).
 *
 * The neuron fires when bias + Σ wᵢxᵢ > 0. A rule is a set of conditions on
 * some inputs that guarantees it fires, whatever the other inputs are.
 */
export interface Neuron {
  weights: readonly number[];
  bias: number;
}

/** "Input i is yes" (value 1) or "input i is no" (value 0). */
export interface Literal {
  input: number;
  value: 0 | 1;
}

export function neuronFires(neuron: Neuron, x: readonly number[]): boolean {
  let z = neuron.bias;
  for (let i = 0; i < x.length; i++) z += neuron.weights[i] * x[i];
  return z > 0;
}

/** Every combination of n yes/no inputs, 0…2ⁿ−1, as arrays. */
export function allInputs(n: number): number[][] {
  return Array.from({ length: 2 ** n }, (_, code) => Array.from({ length: n }, (_, i) => (code >> (n - 1 - i)) & 1));
}

/**
 * Only one condition per input can help a neuron fire: "yes" for a positive
 * weight, "no" for a negative one. Inputs with zero weight never matter.
 */
export function helpfulLiteral(neuron: Neuron, input: number): Literal | null {
  const w = neuron.weights[input];
  return w > 0 ? { input, value: 1 } : w < 0 ? { input, value: 0 } : null;
}

/**
 * The lowest the neuron's total can be when the literals in `chosen` hold and
 * every other input takes its worst value.
 */
export function worstCase(neuron: Neuron, chosen: ReadonlySet<number>): number {
  let z = neuron.bias;
  neuron.weights.forEach((w, i) => {
    if (chosen.has(i)) z += w > 0 ? w : 0;
    else z += w < 0 ? w : 0;
  });
  return z;
}

export interface SubsetStep {
  /** Inputs whose helpful literal is assumed to hold. */
  subset: number[];
  outcome: 'rule' | 'not enough' | 'skipped';
  worst: number;
}

export interface SubsetResult {
  rules: Literal[][];
  steps: SubsetStep[];
  /** Subsets actually tested (the rest were skipped as supersets of rules already found). */
  examined: number;
  /** All subsets of the inputs that matter: 2ⁿ. */
  total: number;
}

/**
 * Tries subsets of inputs smallest first. A subset is a rule when its worst
 * case still fires. Supersets of a rule are skipped: they're rules too, but
 * redundant. What's left is every minimal rule.
 */
export function subsetSearch(neuron: Neuron): SubsetResult {
  const useful = neuron.weights.flatMap((_, i) => (helpfulLiteral(neuron, i) ? [i] : []));
  const n = useful.length;
  const found: Set<number>[] = [];
  const steps: SubsetStep[] = [];
  let examined = 0;

  const subsets: number[][] = [];
  for (let mask = 0; mask < 2 ** n; mask++) subsets.push(useful.filter((_, j) => (mask >> j) & 1));
  subsets.sort((a, b) => a.length - b.length || compareArrays(a, b));

  for (const subset of subsets) {
    if (found.some((rule) => [...rule].every((i) => subset.includes(i)))) {
      steps.push({ subset, outcome: 'skipped', worst: worstCase(neuron, new Set(subset)) });
      continue;
    }
    examined++;
    const worst = worstCase(neuron, new Set(subset));
    if (worst > 0) {
      found.push(new Set(subset));
      steps.push({ subset, outcome: 'rule', worst });
    } else {
      steps.push({ subset, outcome: 'not enough', worst });
    }
  }

  return {
    rules: found.map((rule) => [...rule].map((i) => helpfulLiteral(neuron, i)!)),
    steps,
    examined,
    total: 2 ** n,
  };
}

/* ---------------- M-of-N ---------------- */

export interface MofNGroup {
  /** The literals in the group. */
  literals: Literal[];
  /** The group's shared weight: the average of its members' helpful weights. */
  weight: number;
}

/** "At least k of group g" for each group (0 = no condition on that group). */
export interface MofNRule {
  counts: number[];
}

export interface MofNResult {
  groups: MofNGroup[];
  rules: MofNRule[];
  /** Share of all 2ⁿ inputs where the M-of-N rules agree with the original neuron. */
  fidelity: number;
}

/**
 * Towell & Shavlik's idea: trained networks tend to have a few distinct weight
 * levels. Cluster the helpful weights, give each cluster its average, and the
 * rules can be counted instead of listed: "at least 2 of {A, B, C}".
 * `tolerance` is how far apart (relative to the largest weight) two weights
 * may be and still share a group.
 */
export function mOfN(neuron: Neuron, tolerance = 0.25): MofNResult {
  const n = neuron.weights.length;
  const literals = neuron.weights.flatMap((_, i) => {
    const literal = helpfulLiteral(neuron, i);
    return literal ? [{ literal, weight: Math.abs(neuron.weights[i]) }] : [];
  });
  literals.sort((a, b) => b.weight - a.weight || a.literal.input - b.literal.input);
  const scale = literals[0]?.weight ?? 1;

  // Single-link clustering on a line: a gap bigger than the tolerance starts a new group.
  const groups: MofNGroup[] = [];
  let members: typeof literals = [];
  const flush = () => {
    if (members.length === 0) return;
    groups.push({ literals: members.map((m) => m.literal), weight: members.reduce((s, m) => s + m.weight, 0) / members.length });
    members = [];
  };
  for (const item of literals) {
    if (members.length > 0 && members[members.length - 1].weight - item.weight > tolerance * scale) flush();
    members.push(item);
  }
  flush();

  // Total when no helpful literal holds: positive inputs off, negative inputs on.
  const base = neuron.bias + neuron.weights.reduce((s, w) => s + (w < 0 ? w : 0), 0);
  const fires = (counts: readonly number[]) => base + counts.reduce((s, k, g) => s + k * groups[g].weight, 0) > 0;

  // Minimal count vectors that guarantee firing.
  const rules: MofNRule[] = [];
  const vectors = countVectors(groups.map((g) => g.literals.length));
  vectors.sort((a, b) => sum(a) - sum(b));
  for (const counts of vectors) {
    if (!fires(counts)) continue;
    if (rules.some((r) => r.counts.every((k, g) => k <= counts[g]))) continue;
    rules.push({ counts });
  }

  // How faithful the averaged version is to the real neuron, over every input.
  const inputs = allInputs(n);
  const agree = inputs.filter((x) => mOfNPredict(groups, rules, x) === neuronFires(neuron, x)).length;
  return { groups, rules, fidelity: agree / inputs.length };
}

export function mOfNPredict(groups: readonly MofNGroup[], rules: readonly MofNRule[], x: readonly number[]): boolean {
  const satisfied = groups.map((g) => g.literals.filter((l) => x[l.input] === l.value).length);
  return rules.some((r) => r.counts.every((k, g) => satisfied[g] >= k));
}

function countVectors(sizes: readonly number[]): number[][] {
  let all: number[][] = [[]];
  for (const size of sizes) {
    const next: number[][] = [];
    for (const prefix of all) for (let k = 0; k <= size; k++) next.push([...prefix, k]);
    all = next;
  }
  return all;
}

function sum(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0);
}

function compareArrays(a: readonly number[], b: readonly number[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i];
  return a.length - b.length;
}
