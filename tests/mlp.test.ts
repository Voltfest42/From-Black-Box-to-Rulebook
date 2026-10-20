import { describe, expect, it } from 'vitest';
import { guardGrid, guardLogs, guardRule } from '../src/core/data/guard';
import { ALL_ROBOTS, monkTrainingSet, monkTruth } from '../src/core/data/robots';
import { trainNetwork } from '../src/core/models/blackbox';
import { lossGradients, Mlp, Trainer, type Activation } from '../src/core/models/mlp';
import { agreement, labelAll } from '../src/core/rules/metrics';

describe('Mlp', () => {
  it.each<Activation>(['tanh', 'sigmoid', 'relu'])('computes exact gradients (%s): backprop matches finite differences', (activation) => {
    const net = new Mlp(3, [4, 3], { activation, seed: 11 });
    const X = [
      [0.5, -1, 0.2],
      [-0.3, 0.8, 1],
      [1, 1, -0.5],
    ];
    const y = [1, 0, 1];
    const rows = [0, 1, 2];
    const { gW, gb } = lossGradients(net, X, y, rows);
    const lossAt = () => lossGradients(net, X, y, rows).loss;
    const h = 1e-6;
    for (let l = 0; l < net.W.length; l++) {
      for (let k = 0; k < net.W[l].length; k++) {
        const original = net.W[l][k];
        net.W[l][k] = original + h;
        const up = lossAt();
        net.W[l][k] = original - h;
        const down = lossAt();
        net.W[l][k] = original;
        expect(gW[l][k]).toBeCloseTo((up - down) / (2 * h), 5);
      }
      for (let k = 0; k < net.b[l].length; k++) {
        const original = net.b[l][k];
        net.b[l][k] = original + h;
        const up = lossAt();
        net.b[l][k] = original - h;
        const down = lossAt();
        net.b[l][k] = original;
        expect(gb[l][k]).toBeCloseTo((up - down) / (2 * h), 5);
      }
    }
  });

  it('learns XOR, which no single neuron can', () => {
    const X = [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
    const y = [0, 1, 1, 0];
    const net = new Mlp(2, [4], { seed: 3 });
    const trainer = new Trainer(net, X, y, { learningRate: 0.05 });
    for (let e = 0; e < 1500; e++) trainer.epoch();
    expect(X.map((x) => (net.predict(x) >= 0.5 ? 1 : 0))).toEqual(y);
    expect(trainer.loss()).toBeLessThan(0.05);
  });

  it('is repeatable: the same seed gives the same weights', () => {
    const data = monkTrainingSet(1, 1);
    const a = trainNetwork(data, { epochs: 20, seed: 4 });
    const b = trainNetwork(data, { epochs: 20, seed: 4 });
    expect(a.net.toJSON()).toEqual(b.net.toJSON());
    expect(Mlp.fromJSON(a.net.toJSON()).toJSON()).toEqual(a.net.toJSON());
  });

  it('learns MONK-1 from 124 robots and gets all 432 right, for many seeds', () => {
    const data = monkTrainingSet(1, 1);
    for (let seed = 1; seed <= 5; seed++) {
      const { box } = trainNetwork(data, { hidden: [6], epochs: 250, seed });
      expect(agreement(labelAll(box.label, ALL_ROBOTS), monkTruth(1)), `seed ${seed}`).toBe(1);
    }
  });

  it('learns the guard from noisy logs, matching the game on most of the map', () => {
    const { box } = trainNetwork(guardLogs({ seed: 1 }), { hidden: [12, 12], epochs: 400, seed: 1 });
    const grid = guardGrid(60, 60);
    const truth = grid.map((x) => (guardRule(x) ? 1 : 0));
    expect(agreement(labelAll(box.label, grid), truth)).toBeGreaterThan(0.93);
  });
});
