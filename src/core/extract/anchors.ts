import type { CategoricalFeature, Instance } from '../data/dataset';
import { Random } from '../random';
import type { Labeler } from '../rules/metrics';

/**
 * Anchors (Ribeiro, Singh & Guestrin, AAAI 2018) for categorical features.
 *
 * An anchor for case x is a set of x's own feature values ("jacket is red")
 * such that, whatever the other features are, the model gives x's answer with
 * probability at least τ. Among anchors, the one that applies most widely
 * (highest coverage) is preferred.
 *
 * Candidates are grown one condition at a time with a beam search. Their
 * precision can only be estimated by sampling, so a multi-armed bandit
 * (KL-LUCB) decides which candidates to sample next, until it is confident
 * which ones are best.
 */
export interface AnchorOptions {
  /** Precision required (the paper: 0.95). */
  tau?: number;
  /** Confidence parameter (the paper: 0.05). */
  delta?: number;
  /** Tolerance of the bandit (the paper: 0.1). */
  epsilon?: number;
  /** Beam width (the paper: 10). */
  beam?: number;
  /** Samples per pull. */
  batch?: number;
  /** Safety cap on samples per candidate. */
  maxSamples?: number;
  seed?: number;
}

export interface Candidate {
  /** Features fixed to x's values. */
  features: number[];
  samples: number;
  positives: number;
  mean: number;
  lower: number;
  upper: number;
  /** Share of all cases the rule applies to. */
  coverage: number;
}

export type AnchorEvent =
  | { kind: 'round'; length: number; candidates: Candidate[]; beam: number[]; anchors: number[]; samplesSoFar: number }
  | { kind: 'result'; anchor: Candidate | null; samplesSoFar: number };

export interface AnchorResult {
  anchor: Candidate | null;
  samples: number;
}

/* ---------------- KL confidence bounds ---------------- */

function kl(p: number, q: number): number {
  const a = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
  const b = Math.min(Math.max(q, 1e-12), 1 - 1e-12);
  return a * Math.log(a / b) + (1 - a) * Math.log((1 - a) / (1 - b));
}

/** The largest q ≥ p with n·KL(p, q) ≤ level (bisection). */
export function klUpper(p: number, n: number, level: number): number {
  let lo = p;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (n * kl(p, mid) > level) hi = mid;
    else lo = mid;
  }
  return lo;
}

/** The smallest q ≤ p with n·KL(p, q) ≤ level. */
export function klLower(p: number, n: number, level: number): number {
  let lo = 0;
  let hi = p;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (n * kl(p, mid) > level) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Exploration rate of KL-LUCB (Kaufmann & Kalyanakrishnan, 2013), as used for anchors. */
function beta(arms: number, t: number, delta: number): number {
  return Math.log((405.5 * arms * t ** 1.1) / delta);
}

/* ---------------- the search ---------------- */

export function anchors(
  label: Labeler,
  x: Instance,
  features: readonly CategoricalFeature[],
  options: AnchorOptions = {},
  emit?: (e: AnchorEvent) => void,
): AnchorResult {
  const { tau = 0.95, delta = 0.05, epsilon = 0.1, beam = 10, batch = 10, maxSamples = 2000, seed = 1 } = options;
  const rng = new Random(seed);
  const target = label(x);
  let used = 0;

  /** A case where the anchored features keep x's values and the rest are random. */
  const perturb = (fixed: readonly number[]): Instance => features.map((f, i) => (fixed.includes(i) ? x[i] : rng.int(f.values.length)));
  // Coverage: the share of random cases the rule applies to (exact here, since every value is equally likely).
  const coverageOf = (fixed: readonly number[]) => fixed.reduce((c, i) => c / features[i].values.length, 1);

  const make = (fixed: number[]): Candidate => ({ features: fixed, samples: 0, positives: 0, mean: 0, lower: 0, upper: 1, coverage: coverageOf(fixed) });
  const pull = (c: Candidate, n: number) => {
    for (let k = 0; k < n; k++) if (label(perturb(c.features)) === target) c.positives++;
    c.samples += n;
    used += n;
    c.mean = c.positives / c.samples;
  };
  const bound = (c: Candidate, level: number) => {
    c.lower = klLower(c.mean, c.samples, level);
    c.upper = klUpper(c.mean, c.samples, level);
  };

  /** KL-LUCB: sample until confident which `beam` candidates have the highest precision. */
  const topCandidates = (cands: Candidate[]): number[] => {
    for (const c of cands) if (c.samples === 0) pull(c, batch);
    if (cands.length <= beam) {
      cands.forEach((c) => bound(c, beta(cands.length, 1, delta)));
      return cands.map((_, i) => i);
    }
    let t = 1;
    for (;;) {
      const level = beta(cands.length, t, delta);
      cands.forEach((c) => bound(c, level));
      const order = cands.map((_, i) => i).sort((a, b) => cands[b].mean - cands[a].mean);
      const top = order.slice(0, beam);
      const rest = order.slice(beam);
      const weakest = top.reduce((a, b) => (cands[b].lower < cands[a].lower ? b : a));
      const challenger = rest.reduce((a, b) => (cands[b].upper > cands[a].upper ? b : a));
      if (cands[challenger].upper - cands[weakest].lower < epsilon || t > 200) return top;
      if (cands[weakest].samples < maxSamples) pull(cands[weakest], batch);
      if (cands[challenger].samples < maxSamples) pull(cands[challenger], batch);
      t++;
    }
  };

  /** Sample a candidate until it is clearly an anchor, or clearly not (alibi's stopping rule). */
  const isAnchor = (c: Candidate): boolean => {
    const stop = 0.05;
    for (let t = 1; c.samples < maxSamples; t++) {
      bound(c, beta(1, t, delta));
      if (c.mean >= tau && c.lower < tau - stop) pull(c, batch);
      else if (c.mean < tau && c.upper >= tau + stop) pull(c, batch);
      else break;
    }
    bound(c, beta(1, 1, delta));
    return c.mean >= tau && c.lower > tau - stop;
  };

  let current: number[][] = [[]];
  let best: Candidate | null = null;
  for (let length = 1; length <= features.length; length++) {
    // Extend every rule in the beam by one more of x's values.
    const seen = new Set<string>();
    const candidates: Candidate[] = [];
    for (const rule of current) {
      for (let f = 0; f < features.length; f++) {
        if (rule.includes(f)) continue;
        const fixed = [...rule, f].sort((a, b) => a - b);
        const key = fixed.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        // Adding conditions only lowers coverage, so these can't beat the best anchor.
        if (best && coverageOf(fixed) <= best.coverage) continue;
        candidates.push(make(fixed));
      }
    }
    if (candidates.length === 0) break;
    const top = topCandidates(candidates);
    const anchorsHere = top.filter((i) => isAnchor(candidates[i]));
    for (const i of anchorsHere) if (!best || candidates[i].coverage > best.coverage) best = candidates[i];
    emit?.({ kind: 'round', length, candidates: candidates.map((c) => ({ ...c })), beam: top, anchors: anchorsHere, samplesSoFar: used });
    current = top.filter((i) => !anchorsHere.includes(i)).map((i) => candidates[i].features);
    if (current.length === 0) break;
  }
  emit?.({ kind: 'result', anchor: best ? { ...best } : null, samplesSoFar: used });
  return { anchor: best, samples: used };
}
