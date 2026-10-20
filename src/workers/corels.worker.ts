import { monkTrainingSet, ROBOT_FEATURES, type MonkProblem } from '../core/data/robots';
import { corels, robotAntecedents, type CorelsEvent, type CorelsResult } from '../core/learn/corels';

export interface CorelsRequest {
  problem: MonkProblem;
  lambda: number;
}

export type CorelsMessage = { kind: 'start'; antecedents: number; cases: number } | { kind: 'event'; event: CorelsEvent } | { kind: 'done'; result: CorelsResult } | { kind: 'error'; message: string };

// The project is type-checked with DOM types; inside a worker only these two members are used.
const worker = self as unknown as {
  onmessage: (event: MessageEvent<CorelsRequest>) => void;
  postMessage: (message: CorelsMessage) => void;
};

/** Runs the branch-and-bound search off the main thread, reporting progress as it goes. */
worker.onmessage = (event) => {
  const post = (message: CorelsMessage) => worker.postMessage(message);
  try {
    const { problem, lambda } = event.data;
    const data = monkTrainingSet(problem, 1);
    const antecedents = robotAntecedents(ROBOT_FEATURES, data.X);
    post({ kind: 'start', antecedents: antecedents.length, cases: data.X.length });
    const result = corels(antecedents, data.y, { lambda, maxNodes: 4_000_000, every: 25_000 }, (e) => post({ kind: 'event', event: e }));
    post({ kind: 'done', result });
  } catch (error) {
    post({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
