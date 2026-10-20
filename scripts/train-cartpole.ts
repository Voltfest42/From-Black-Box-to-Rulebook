/**
 * Pre-trains the neural cart-pole agent used in Chapter 3 (Figure 3.4) and saves
 * its weights to src/data/cartpole-teacher.json.
 *
 * Method: the cross-entropy method, a simple evolutionary search. Each round,
 * sample a population of weight vectors around a mean, keep the best few by how
 * long they balance the pole, and move the mean towards them.
 *
 *   npx tsx scripts/train-cartpole.ts
 */
import { writeFileSync } from 'node:fs';
import { Mlp } from '../src/core/models/mlp';
import { Random } from '../src/core/random';
import { normalise, score, type CartState } from '../src/core/sim/cartpole';

const HIDDEN = 8;
const POPULATION = 60;
const ELITE = 8;
const ROUNDS = 40;

const template = new Mlp(4, [HIDDEN], { seed: 1 });
const size = template.parameterCount;

function toNet(theta: Float64Array): Mlp {
  const net = template.clone();
  let k = 0;
  for (let l = 0; l < net.W.length; l++) {
    for (let i = 0; i < net.W[l].length; i++) net.W[l][i] = theta[k++];
    for (let i = 0; i < net.b[l].length; i++) net.b[l][i] = theta[k++];
  }
  return net;
}

const policyOf = (net: Mlp) => (s: CartState) => (net.predict(normalise(s)) >= 0.5 ? 1 : 0);

const rng = new Random(2026);
const mean = new Float64Array(size);
const sd = new Float64Array(size).fill(1);
let best = { fitness: -1, theta: mean.slice() };

for (let round = 1; round <= ROUNDS; round++) {
  const population = Array.from({ length: POPULATION }, () => {
    const theta = Float64Array.from(mean, (m, k) => m + sd[k] * rng.normal());
    return { theta, fitness: score(policyOf(toNet(theta)), 5, round) };
  });
  population.sort((a, b) => b.fitness - a.fitness);
  const elite = population.slice(0, ELITE);
  for (let k = 0; k < size; k++) {
    const values = elite.map((e) => e.theta[k]);
    const m = values.reduce((s, v) => s + v, 0) / ELITE;
    mean[k] = m;
    sd[k] = Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / ELITE) + 0.02;
  }
  if (elite[0].fitness >= best.fitness) best = { fitness: elite[0].fitness, theta: elite[0].theta };
  console.log(`round ${round}: best ${elite[0].fitness.toFixed(1)}, mean policy ${score(policyOf(toNet(mean)), 10, 999).toFixed(1)}`);
}

// Prefer the mean if it is at least as good on fresh starts.
const candidates = [
  { name: 'mean', theta: mean },
  { name: 'best', theta: best.theta },
].map((c) => ({ ...c, test: score(policyOf(toNet(c.theta)), 50, 12345) }));
candidates.sort((a, b) => b.test - a.test);
const chosen = candidates[0];
console.log(`chosen: ${chosen.name}, ${chosen.test.toFixed(1)} steps on 50 fresh starts`);

const out = new URL('../src/data/cartpole-teacher.json', import.meta.url);
writeFileSync(out, JSON.stringify({ trainedWith: 'cross-entropy method, scripts/train-cartpole.ts', testSteps: chosen.test, network: toNet(chosen.theta).toJSON() }, null, 1) + '\n');
console.log(`saved ${out.pathname}`);
