import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeEncoder } from '../src/core/data/dataset';
import { COMBO_MACHINE, comboTargets, practiceSessions, randomPresses } from '../src/core/data/combo';
import { ALL_ROBOTS, monkTrainingSet, monkTruth, ROBOT_FEATURES } from '../src/core/data/robots';
import { equivalent, extractMachine, machineFidelity, minimise, runMachine, visit, type Machine } from '../src/core/extract/automaton';
import { conjunctionSpace, extractNetwork } from '../src/core/extract/networkRules';
import { allInputs, mOfN, mOfNPredict, neuronFires, subsetSearch, type Neuron } from '../src/core/extract/subsets';
import { Mlp, Trainer } from '../src/core/models/mlp';
import { Rnn, RnnTrainer } from '../src/core/models/rnn';
import { forEachBit, or } from '../src/core/rules/bitset';
import { Random } from '../src/core/random';

const neuronArb = fc.record({
  weights: fc.array(fc.integer({ min: -8, max: 8 }).map((w) => w / 2), { minLength: 1, maxLength: 6 }),
  bias: fc.integer({ min: -12, max: 6 }).map((b) => b / 2),
});

describe('subset search (KT)', () => {
  it('finds rules that together say exactly when the neuron fires', () => {
    fc.assert(
      fc.property(neuronArb, (neuron: Neuron) => {
        const { rules } = subsetSearch(neuron);
        for (const x of allInputs(neuron.weights.length)) {
          const byRules = rules.some((rule) => rule.every((l) => x[l.input] === l.value));
          expect(byRules).toBe(neuronFires(neuron, x));
        }
      }),
      { numRuns: 300 },
    );
  });

  it('keeps only minimal rules, and skips supersets of rules already found', () => {
    fc.assert(
      fc.property(neuronArb, (neuron: Neuron) => {
        const { rules, examined, total, steps } = subsetSearch(neuron);
        for (const a of rules) for (const b of rules) if (a !== b) expect(a.every((l) => b.some((m) => m.input === l.input))).toBe(false);
        expect(examined + steps.filter((s) => s.outcome === 'skipped').length).toBe(total);
      }),
      { numRuns: 300 },
    );
  });

  it('reads a vote of three as three rules, or one M-of-N rule', () => {
    const vote: Neuron = { weights: [2, 2, 2, 0, 0], bias: -3 };
    expect(subsetSearch(vote).rules).toHaveLength(3);
    const m = mOfN(vote);
    expect(m.groups).toHaveLength(1);
    expect(m.rules).toEqual([{ counts: [2] }]);
    expect(m.fidelity).toBe(1);
  });

  it('M-of-N rules approximate a neuron whose weights are only roughly equal', () => {
    const neuron: Neuron = { weights: [2.2, 1.9, 2.1, -0.2, 0.1], bias: -3 };
    const m = mOfN(neuron);
    for (const x of allInputs(5)) if (Math.abs(neuron.bias + neuron.weights.reduce((s, w, i) => s + w * x[i], 0)) > 0.6) expect(mOfNPredict(m.groups, m.rules, x)).toBe(neuronFires(neuron, x));
    expect(m.fidelity).toBeGreaterThan(0.85);
  });
});

describe('layer-by-layer extraction from the robot network', () => {
  const encoder = makeEncoder(ROBOT_FEATURES);
  const data = monkTrainingSet(1, 1);
  const net = new Mlp(encoder.size, [4], { seed: 1, activation: 'sigmoid' });
  const trainer = new Trainer(net, data.X.map((x) => encoder.encode(x)), data.y, { learningRate: 0.03, batchSize: 16, seed: 1, l2: 0.0005 });
  for (let e = 0; e < 400; e++) trainer.epoch();
  const extraction = extractNetwork(net, encoder, ROBOT_FEATURES, ALL_ROBOTS);

  it('searches 27,783 conjunctions per unit and state', () => {
    expect(conjunctionSpace(ROBOT_FEATURES)).toHaveLength(7 * 7 * 3 * 7 * 9 * 3);
    expect(extraction.space).toBe(27_783);
  });

  it("finds rules whose union is exactly where each hidden unit is on (or off)", () => {
    extraction.units.forEach((unit) => {
      const z = ALL_ROBOTS.map((x) => {
        const v = encoder.encode(x);
        return net.b[0][unit.unit] + v.reduce((s, xi, i) => s + net.W[0][unit.unit * encoder.size + i] * xi, 0);
      });
      for (const [rules, on] of [[unit.on, true], [unit.off, false]] as const) {
        const covered = new Set<number>();
        if (rules.length) forEachBit(rules.map((r) => r.coverage).reduce(or), (i) => void covered.add(i));
        ALL_ROBOTS.forEach((_, i) => expect(covered.has(i)).toBe(on ? z[i] > 0 : z[i] <= 0));
      }
    });
  });

  it('recovers the hidden rule from this network: four short rules, 100% faithful', () => {
    const predictions = ALL_ROBOTS.map((x) => (net.predict(encoder.encode(x)) >= 0.5 ? 1 : 0));
    expect(extraction.binarized).toEqual(predictions);
    expect(extraction.simplified).toHaveLength(4);
    const byRules = ALL_ROBOTS.map((_, i) => (extraction.simplified.some((r) => (r.coverage[i >>> 5] >>> (i & 31)) & 1) ? 1 : 0));
    expect(byRules).toEqual(monkTruth(1));
  });
});

describe('recurrent network and automaton extraction', () => {
  it('computes exact gradients through time', () => {
    const rnn = new Rnn(3, 3, 5);
    const seq = [0, 1, 2, 2, 0];
    const target = [0, 1, 0, 1, 1];
    const grad = new Float64Array(rnn.theta.length);
    rnn.gradient(seq, target, grad);
    const lossAt = () => rnn.gradient(seq, target, new Float64Array(rnn.theta.length));
    for (let k = 0; k < rnn.theta.length; k++) {
      const original = rnn.theta[k];
      rnn.theta[k] = original + 1e-6;
      const up = lossAt();
      rnn.theta[k] = original - 1e-6;
      const down = lossAt();
      rnn.theta[k] = original;
      expect(grad[k]).toBeCloseTo((up - down) / 2e-6, 5);
    }
  });

  it('the hand-written machine fires exactly on the move', () => {
    const rng = new Random(4);
    for (let i = 0; i < 50; i++) {
      const seq = randomPresses(rng, 30);
      expect(runMachine(COMBO_MACHINE as unknown as Machine, seq).outputs).toEqual(comboTargets(seq));
    }
  });

  it('minimises a machine with duplicate states', () => {
    // Two copies of "nothing useful yet" (0 and 4).
    const bloated: Machine = {
      start: 0,
      next: [
        [1, 4, 0],
        [1, 2, 4],
        [1, 0, 3],
        [1, 4, 0],
        [1, 0, 4],
      ],
      output: [0, 0, 0, 1, 0],
    };
    const { machine } = minimise(bloated, 3);
    expect(machine.output).toHaveLength(4);
    expect(equivalent(machine, COMBO_MACHINE as unknown as Machine, 3)).toBe(true);
  });

  it('learns the move and gives back the 4-state machine', () => {
    const train = practiceSessions(200, 16, 7);
    const rnn = new Rnn(3, 4, 3);
    const trainer = new RnnTrainer(rnn, train, train.map(comboTargets), { learningRate: 0.03, batchSize: 10, seed: 3 });
    for (let e = 0; e < 80; e++) trainer.epoch();
    const { minimal } = extractMachine(visit(rnn, practiceSessions(60, 16, 123)), 8, 3, 1);
    expect(minimal.output).toHaveLength(4);
    expect(equivalent(minimal, COMBO_MACHINE as unknown as Machine, 3)).toBe(true);
    const rng = new Random(99);
    const test = Array.from({ length: 300 }, () => randomPresses(rng, 20));
    expect(machineFidelity(minimal, rnn, test).perPress).toBeGreaterThan(0.99);
  });
});
