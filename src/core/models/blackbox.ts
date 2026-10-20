import { makeEncoder, type Dataset, type Encoder, type Instance } from '../data/dataset';
import type { Labeler } from '../rules/metrics';
import { Mlp, Trainer, type Activation } from './mlp';

/** A trained model seen from outside: give it a case, get P(yes). */
export interface BlackBox {
  proba(x: Instance): number;
  label: Labeler;
}

export function networkBlackBox(net: Mlp, encoder: Encoder): BlackBox {
  const proba = (x: Instance) => net.predict(encoder.encode(x));
  return { proba, label: (x) => (proba(x) >= 0.5 ? 1 : 0) };
}

export interface NetworkOptions {
  hidden?: readonly number[];
  activation?: Activation;
  epochs?: number;
  learningRate?: number;
  batchSize?: number;
  l2?: number;
  seed?: number;
}

export interface TrainedNetwork {
  net: Mlp;
  encoder: Encoder;
  box: BlackBox;
  /** Mean training loss after each epoch. */
  losses: number[];
}

/** Trains a network on a dataset in one go (figures that animate training use Trainer directly). */
export function trainNetwork(data: Dataset, options: NetworkOptions = {}): TrainedNetwork {
  const { hidden = [8], activation = 'tanh', epochs = 300, learningRate = 0.02, batchSize = 32, l2 = 0, seed = 1 } = options;
  const encoder = makeEncoder(data.features);
  const net = new Mlp(encoder.size, hidden, { activation, seed });
  const trainer = new Trainer(net, data.X.map((x) => encoder.encode(x)), data.y, { learningRate, batchSize, l2, seed });
  const losses: number[] = [];
  for (let e = 0; e < epochs; e++) losses.push(trainer.epoch());
  return { net, encoder, box: networkBlackBox(net, encoder), losses };
}
