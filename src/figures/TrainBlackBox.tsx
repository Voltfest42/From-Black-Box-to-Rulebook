import { useMemo, useState, type ReactNode } from 'react';
import { makeEncoder } from '../core/data/dataset';
import { ALL_ROBOTS, describeRobot, monkTrainingSet, monkTruth, ROBOT_FEATURES, type MonkProblem } from '../core/data/robots';
import { Mlp, Trainer } from '../core/models/mlp';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure, Legend } from '../viz/Figure';
import { LossChart } from '../viz/LossChart';
import { NetworkDiagram } from '../viz/NetworkDiagram';
import { GRID_KEY } from '../viz/robots/layout';
import { RobotGrid } from '../viz/robots/RobotGrid';
import { useTraining } from '../viz/useTraining';
import figureStyles from './figures.module.css';
import styles from './TrainBlackBox.module.css';

const EPOCHS = 250;
const HIDDEN = 6;
const encoder = makeEncoder(ROBOT_FEATURES);
const encodedRobots = ALL_ROBOTS.map((x) => encoder.encode(x));

const PUZZLES: { problem: MonkProblem; label: string }[] = [
  { problem: 1, label: 'Puzzle 1' },
  { problem: 3, label: 'Puzzle 2 (noisy)' },
  { problem: 2, label: 'Puzzle 3 (hard)' },
];

export function TrainBlackBoxFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <TrainBlackBox number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function TrainBlackBox({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [problem, setProblem] = useState<MonkProblem>(1);
  const [seed, setSeed] = useState(1);
  const [hovered, setHovered] = useState<number | null>(null);
  const [showWeights, setShowWeights] = useState(false);

  const data = useMemo(() => monkTrainingSet(problem, 1), [problem]);
  const truth = useMemo(() => monkTruth(problem), [problem]);
  const run = useTraining(
    () => {
      const net = new Mlp(encoder.size, [HIDDEN], { seed });
      return new Trainer(net, data.X.map((x) => encoder.encode(x)), data.y, { learningRate: 0.02, batchSize: 32, seed });
    },
    `${problem}-${seed}`,
    EPOCHS,
    5,
  );
  const net = run.trainer.net;

  // Recomputed on every frame of training: 432 small forward passes.
  const predictions = encodedRobots.map((v) => (net.predict(v) >= 0.5 ? 1 : 0));
  const trainingSet = new Set(data.indices);
  const dots = ALL_ROBOTS.map((_, i) => trainingSet.has(i));
  const wrong = predictions.map((p, i) => p !== truth[i]);
  const rightAll = predictions.filter((p, i) => p === truth[i]).length;
  const rightTrain = data.indices.filter((index, j) => predictions[index] === data.y[j]).length;

  const caption =
    run.epoch === 0
      ? `An untrained network with random weights: its answers are noise. It will learn from the ${data.X.length} dotted robots only.`
      : run.done
        ? `Trained. It agrees with ${rightTrain} of the ${data.X.length} training labels and gets ${rightAll} of all 432 robots right${problem === 3 ? ', although 6 of its training labels were deliberately wrong' : ''}. Every answer comes from the ${net.parameterCount} numbers in the diagram.`
        : `Training, round ${run.epoch} of ${EPOCHS}: the network nudges its weights to reduce its error on the training robots.`;

  return (
    <Figure number={number} title="Train the black box: a neural network learns the robots" tryThis={tryThis}>
      <div className={figureStyles.toolbar}>
        <span className={figureStyles.segmented} role="group" aria-label="Puzzle">
          {PUZZLES.map((p) => (
            <button key={p.problem} type="button" aria-pressed={problem === p.problem} onClick={() => setProblem(p.problem)}>
              {p.label}
            </button>
          ))}
        </span>
        <button type="button" className={`${figureStyles.toolButton} ${styles.primary}`} onClick={run.playing ? run.pause : run.done ? () => setSeed((s) => s + 1) : run.play}>
          {run.playing ? 'Pause' : run.done ? 'Train a new network' : run.epoch > 0 ? 'Continue training' : '▶ Train the network'}
        </button>
        {!run.done && (
          <button type="button" className={figureStyles.toolButton} onClick={run.finish}>
            Skip to the end
          </button>
        )}
        <span className={styles.counter}>
          Round {run.epoch} / {EPOCHS}
        </span>
      </div>

      <div className={figureStyles.withSide}>
        <div>
          <RobotGrid
            tint={predictions}
            wrong={run.epoch > 0 ? wrong : undefined}
            dots={dots}
            hovered={hovered}
            onHover={setHovered}
            ariaLabel={`The network's answer for every robot. It gets ${rightAll} of 432 right.`}
          />
          <Legend
            items={[
              { key: 'yes', label: 'network says friendly' },
              { key: 'no', label: 'network says not friendly' },
              { key: 'example', label: 'training robot' },
              { key: 'disagree', label: 'network is wrong' },
            ]}
          />
          <p className={figureStyles.note}>{GRID_KEY}</p>
        </div>
        <div className={figureStyles.side}>
          <dl className={styles.stats}>
            <div>
              <dt>Training robots right</dt>
              <dd>
                {rightTrain} / {data.X.length}
              </dd>
            </div>
            <div>
              <dt>All 432 robots right</dt>
              <dd>{rightAll} / 432</dd>
            </div>
          </dl>
          <LossChart losses={run.losses} epochs={EPOCHS} />
          <NetworkDiagram net={net} inputNames={encoder.inputNames} activations={hovered === null ? null : net.forward(encodedRobots[hovered])} />
          <p className={figureStyles.note}>
            {hovered === null
              ? 'Point at a robot to see which units it switches on.'
              : `${describeRobot(ALL_ROBOTS[hovered])}: the network says ${(net.predict(encodedRobots[hovered]) * 100).toFixed(0)}% friendly.`}
          </p>
        </div>
      </div>

      <label className={figureStyles.checkbox}>
        <input type="checkbox" checked={showWeights} onChange={(e) => setShowWeights(e.target.checked)} />
        Show me the numbers: everything the network knows
      </label>
      {showWeights && <WeightTable net={net} names={encoder.inputNames} />}
      <Caption>{caption}</Caption>
    </Figure>
  );
}

function WeightTable({ net, names }: { net: Mlp; names: readonly string[] }) {
  const inputs = net.sizes[0];
  const hidden = net.sizes[1];
  return (
    <div className={styles.tableWrap}>
      <table className={styles.weights}>
        <caption>Weights from each input to each hidden unit, plus the biases and the output weights.</caption>
        <thead>
          <tr>
            <th scope="col">Input</th>
            {Array.from({ length: hidden }, (_, j) => (
              <th key={j} scope="col">
                Unit {j + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((name, i) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              {Array.from({ length: hidden }, (_, j) => (
                <td key={j}>{net.W[0][j * inputs + i].toFixed(2)}</td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">bias</th>
            {Array.from(net.b[0], (b, j) => (
              <td key={j}>{b.toFixed(2)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">to the output</th>
            {Array.from(net.W[1], (w, j) => (
              <td key={j}>{w.toFixed(2)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
