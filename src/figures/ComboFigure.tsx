import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { COMBO_MACHINE, COMBO_SYMBOLS, comboTargets, DOWN, FORWARD, practiceSessions, PUNCH, randomPresses } from '../core/data/combo';
import { correspondence, extractMachine, machineFidelity, pca2, runMachine, visit, type Machine } from '../core/extract/automaton';
import { Rnn, RnnTrainer } from '../core/models/rnn';
import { Random } from '../core/random';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { AutomatonView } from '../viz/AutomatonView';
import { Caption, Figure } from '../viz/Figure';
import { LossChart } from '../viz/LossChart';
import { useTraining } from '../viz/useTraining';
import figureStyles from './figures.module.css';
import styles from './ComboFigure.module.css';

const HIDDEN = 4;
const EPOCHS = 80;
const REFERENCE = COMBO_MACHINE as unknown as Machine;
const ROLE_NAMES = ['nothing yet', 'pressed ↓', 'pressed ↓ →', 'special move!'];
const SESSIONS = practiceSessions(200, 16, 7);
const TARGETS = SESSIONS.map(comboTargets);
const PROBES = practiceSessions(60, 16, 123);
const TEST = (() => {
  const rng = new Random(99);
  return Array.from({ length: 500 }, () => randomPresses(rng, 20));
})();
const MAX_HISTORY = 14;

export function ComboFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <Combo number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function Combo({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [seed, setSeed] = useState(1);
  const [clusters, setClusters] = useState(8);
  const [presses, setPresses] = useState<number[]>([]);

  const run = useTraining(() => new RnnTrainer(new Rnn(3, HIDDEN, seed), SESSIONS, TARGETS, { learningRate: 0.03, batchSize: 10, seed }), `combo-${seed}`, EPOCHS, 4);
  const rnn = run.trainer.rnn;

  // Re-extracted whenever training moves on or the cluster count changes (a few milliseconds).
  const result = useMemo(() => {
    const visited = visit(rnn, PROBES);
    const extraction = extractMachine(visited, clusters, 3, 1);
    const project = pca2(visited.states);
    const points = visited.states.map((h, i) => ({ xy: project(h), state: extraction.merged[extraction.assignment[i]] }));
    const fidelity = machineFidelity(extraction.minimal, rnn, TEST);
    let right = 0;
    let total = 0;
    for (const seq of TEST) {
      const t = comboTargets(seq);
      rnn.run(seq).outputs.forEach((p, i) => {
        total++;
        if ((p >= 0.5 ? 1 : 0) === t[i]) right++;
      });
    }
    return { extraction, points, fidelity, networkAccuracy: right / total, roles: correspondence(extraction.minimal, REFERENCE, 3) };
    // `run.epoch` changes whenever the weights do.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rnn, clusters, run.epoch]);

  const machine = result.extraction.minimal;
  const names = result.roles?.map((r) => ROLE_NAMES[r]);
  const machineRun = runMachine(machine, presses);
  const state = presses.length === 0 ? machine.start : machineRun.states[machineRun.states.length - 1];
  const networkOut = presses.length === 0 ? null : rnn.run(presses).outputs[presses.length - 1];
  const machineFires = presses.length > 0 && machine.output[state] === 1;
  const networkFires = networkOut !== null && networkOut >= 0.5;

  const press = (symbol: number) => setPresses((p) => [...p, symbol].slice(-MAX_HISTORY));
  const onKeyDown = (e: KeyboardEvent) => {
    const key = { ArrowDown: DOWN, ArrowRight: FORWARD, p: PUNCH, P: PUNCH }[e.key];
    if (key === undefined || (e.target as HTMLElement).tagName === 'INPUT') return;
    e.preventDefault();
    press(key);
  };

  const pct = (x: number) => `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;
  const states = machine.output.length;
  const caption = run.epoch === 0
    ? 'An untrained network: its hidden states are a jumble, and the machine read from them means nothing yet. Press Train.'
    : !run.done
      ? `Training, round ${run.epoch} of ${EPOCHS}. Watch the cloud of hidden states pull apart into clumps.`
      : result.roles
        ? `${clusters} clusters merge into ${states} states, and the machine is exactly the one a game developer would write by hand. It agrees with the network on ${pct(result.fidelity.perPress)} of presses in 500 random streams.`
        : `With ${clusters} cluster${clusters === 1 ? '' : 's'} the machine has ${states} state${states === 1 ? '' : 's'} and agrees with the network on ${pct(result.fidelity.perPress)} of presses${states === 1 ? ': it never fires at all, but the move is rare, so it is "right" most of the time anyway' : ', but it is not the hand-written machine. Try another number of clusters'}.`;

  return (
    <Figure number={number} title="The combo detector: a recurrent network becomes a state machine" tryThis={tryThis} onKeyDown={onKeyDown}>
      <div className={figureStyles.toolbar}>
        <button type="button" className={`${figureStyles.toolButton} ${styles.primary}`} onClick={run.playing ? run.pause : run.done ? () => setSeed((s) => s + 1) : run.play}>
          {run.playing ? 'Pause' : run.done ? 'Train a new network' : run.epoch > 0 ? 'Continue training' : '▶ Train the network'}
        </button>
        {!run.done && (
          <button type="button" className={figureStyles.toolButton} onClick={run.finish}>
            Skip to the end
          </button>
        )}
        <label className={figureStyles.inputLabel}>
          Clusters:
          <input type="range" min={1} max={12} value={clusters} onChange={(e) => setClusters(Number(e.target.value))} aria-label="Number of clusters" />
          <output className={styles.k}>{clusters}</output>
        </label>
      </div>

      <div className={styles.layout}>
        <div>
          <h4 className={styles.heading}>Hidden states the network visits</h4>
          <StateCloud points={result.points} />
          <ul className={styles.stateKey} aria-label="Colours">
            {machine.output.map((_, s) => (
              <li key={s}>
                <span className={styles.swatch} style={{ background: `var(--cat-${s % 6})` }} aria-hidden="true" />
                state {s + 1}
                {names ? `: ${names[s]}` : ''}
              </li>
            ))}
          </ul>
          <p className={figureStyles.note}>Each dot is the network’s memory (its {HIDDEN} hidden numbers, flattened to 2D) after one press, coloured by the machine state it belongs to. The ringed dot is the start.</p>
        </div>
        <div>
          <h4 className={styles.heading}>The machine read off them</h4>
          <AutomatonView machine={machine} symbols={COMBO_SYMBOLS} names={names} current={state} ariaLabel={`An extracted state machine with ${states} states.${result.roles ? ' It is the same as the hand-written combo detector.' : ''}`} />
          <p className={figureStyles.note}>Arrows: which button leads where. Orange double circles fire the move.</p>
        </div>
      </div>

      <div className={styles.play}>
        <div className={styles.pad} role="group" aria-label="Controller">
          {COMBO_SYMBOLS.map((s, i) => (
            <button key={s} type="button" className={styles.key} onClick={() => press(i)} aria-label={`Press ${['down', 'forward', 'punch'][i]}`}>
              {s}
            </button>
          ))}
          <button type="button" className={figureStyles.toolButton} onClick={() => setPresses([])}>
            Clear
          </button>
        </div>
        <div className={styles.history} aria-label="Presses so far">
          {presses.length === 0 ? <span className={styles.hint}>Press the buttons (or ↓, → and P on your keyboard) to play.</span> : presses.map((p, i) => <span key={i} className={styles.press}>{COMBO_SYMBOLS[p]}</span>)}
        </div>
        <div className={styles.verdicts} aria-live="polite">
          <span className={networkFires ? styles.fired : styles.idle}>Network: {networkOut === null ? '–' : networkFires ? 'special move!' : 'nothing'}</span>
          <span className={machineFires ? styles.fired : styles.idle}>Machine: {presses.length === 0 ? '–' : machineFires ? 'special move!' : 'nothing'}</span>
        </div>
      </div>

      <div className={styles.stats}>
        <LossChart losses={run.losses} epochs={EPOCHS} />
        <dl>
          <div>
            <dt>Network right (vs the ideal detector)</dt>
            <dd>{pct(result.networkAccuracy)}</dd>
          </div>
          <div>
            <dt>Machine agrees with the network</dt>
            <dd>{pct(result.fidelity.perPress)}</dd>
          </div>
          <div>
            <dt>States after merging</dt>
            <dd>{states}</dd>
          </div>
        </dl>
      </div>
      <Caption>{caption}</Caption>
    </Figure>
  );
}

function StateCloud({ points }: { points: { xy: [number, number]; state: number }[] }) {
  const xs = points.map((p) => p.xy[0]);
  const ys = points.map((p) => p.xy[1]);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys), Math.max(...ys)];
  const sx = (x: number) => 12 + ((x - x0) / (x1 - x0 || 1)) * 276;
  const sy = (y: number) => 12 + ((y - y0) / (y1 - y0 || 1)) * 196;
  return (
    <svg viewBox="0 0 300 220" className={styles.cloud} role="img" aria-label={`${points.length} hidden states, coloured by the machine state they belong to.`}>
      <rect width="300" height="220" rx="8" className={styles.cloudBg} />
      {points.map((p, i) => (
        <circle key={i} cx={sx(p.xy[0])} cy={sy(p.xy[1])} r={i === 0 ? 5 : 2.6} style={{ fill: `var(--cat-${Math.max(0, p.state) % 6})` }} className={i === 0 ? styles.startPoint : styles.point} />
      ))}
    </svg>
  );
}
