import { clockProjection, frequencyPower, ModularNet, type ModularOptions } from '../core/learn/modular';

export interface ModularRequest {
  options: ModularOptions;
  epochs: number;
  /** Report a snapshot every this many epochs. */
  every: number;
}

export interface ModularSnapshot {
  epoch: number;
  trainAccuracy: number;
  testAccuracy: number;
  /** Share of the embeddings' energy at each frequency 1 … (p−1)/2. */
  power: number[];
  /** For each frequency, every number's position on that frequency's plane. */
  planes: [number, number][][];
}

export type ModularMessage = { kind: 'snapshot'; snapshot: ModularSnapshot } | { kind: 'done' } | { kind: 'error'; message: string };

// The project is type-checked with DOM types; inside a worker only these two members are used.
const worker = self as unknown as {
  onmessage: (event: MessageEvent<ModularRequest>) => void;
  postMessage: (message: ModularMessage) => void;
};

/** Trains the clock network off the main thread, sending snapshots as it goes. */
worker.onmessage = (event) => {
  try {
    const { options, epochs, every } = event.data;
    const net = new ModularNet(options);
    const snap = (trainAccuracy: number) => {
      const planes = Array.from({ length: (net.p - 1) / 2 }, (_, i) => clockProjection(net, i + 1));
      worker.postMessage({ kind: 'snapshot', snapshot: { epoch: net.epochs, trainAccuracy, testAccuracy: net.accuracy(net.test), power: frequencyPower(net), planes } });
    };
    snap(net.accuracy(net.train));
    while (net.epochs < epochs) {
      const { trainAccuracy } = net.epoch();
      if (net.epochs % every === 0 || net.epochs === epochs) snap(trainAccuracy);
    }
    worker.postMessage({ kind: 'done' });
  } catch (error) {
    worker.postMessage({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
