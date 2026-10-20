import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { clockProjection, frequencyPower, ModularNet, type ModularOptions } from '../core/learn/modular';
import { Caption, Figure } from '../viz/Figure';
import type { ModularMessage, ModularRequest, ModularSnapshot } from '../workers/modular.worker';
import figureStyles from './figures.module.css';
import styles from './ClockFigure.module.css';

const OPTIONS: ModularOptions = { p: 23, trainShare: 0.5, dim: 16, hidden: 48, learningRate: 0.02, weightDecay: 0.5, seed: 1 };
const EPOCHS = 2000;
const EVERY = 20;

/** The untrained network, so the figure has something to show before training starts. */
function initialSnapshot(): ModularSnapshot {
  const net = new ModularNet(OPTIONS);
  return {
    epoch: 0,
    trainAccuracy: net.accuracy(net.train),
    testAccuracy: net.accuracy(net.test),
    power: frequencyPower(net),
    planes: Array.from({ length: (net.p - 1) / 2 }, (_, i) => clockProjection(net, i + 1)),
  };
}

export function ClockFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const start = useMemo(() => initialSnapshot(), []);
  const [snapshots, setSnapshots] = useState<ModularSnapshot[]>([start]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const worker = useRef<Worker | null>(null);

  useEffect(() => () => worker.current?.terminate(), []);

  const train = () => {
    worker.current?.terminate();
    const w = new Worker(new URL('../workers/modular.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    setSnapshots([]);
    setView(null);
    setError(null);
    setRunning(true);
    w.onmessage = (event: MessageEvent<ModularMessage>) => {
      const m = event.data;
      if (m.kind === 'snapshot') setSnapshots((s) => [...s, m.snapshot]);
      if (m.kind === 'error') setError(m.message);
      if (m.kind === 'done' || m.kind === 'error') {
        setRunning(false);
        w.terminate();
      }
    };
    w.postMessage({ options: OPTIONS, epochs: EPOCHS, every: EVERY } satisfies ModularRequest);
  };

  const shown = snapshots.length ? snapshots : [start];
  const index = view === null || running ? shown.length - 1 : Math.min(view, shown.length - 1);
  const snap = shown[index];
  const last = shown[shown.length - 1];
  // Unless the reader picks one, show the frequency the network ends up using most.
  const top = last.power.indexOf(Math.max(...last.power)) + 1;
  const k = chosen ?? top;
  const p = OPTIONS.p!;
  const trained = !running && last.epoch === EPOCHS;
  const testPairs = p * p - Math.round(OPTIONS.trainShare! * p * p);

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const strong = [...snap.power].sort((a, b) => b - a).slice(0, 4).reduce((s, v) => s + v, 0);
  const caption = error
    ? `Training failed: ${error}`
    : snap.epoch === 0
      ? `Before training, every number from 0 to ${p - 1} gets a random vector. On the plane of any frequency, the numbers are a scattered cloud, and the network's answers are guesses.`
      : `Epoch ${snap.epoch}: right on ${pct(snap.trainAccuracy)} of the training sums and ${pct(snap.testAccuracy)} of the ${testPairs} sums it has never seen. ` +
        (snap.testAccuracy >= 0.95
          ? `The numbers now sit on circles. On frequency ${k}, adding 1 turns ${k}/${p} of the way round, so the network can add by turning. The 4 strongest frequencies hold ${pct(strong)} of the embeddings' energy.`
          : snap.trainAccuracy >= 0.99
            ? 'It has memorised the training sums, but the circles have not formed yet, so it still gets many new sums wrong. Weight decay keeps squeezing the weights, which favours a simpler, general solution.'
            : 'It is still learning the training sums.');

  return (
    <Figure number={number} title="The clock inside: a network that learns to add on a clock" tryThis={tryThis}>
      <div className={figureStyles.toolbar}>
        <button type="button" className={`${figureStyles.toolButton} ${styles.primary}`} onClick={train} disabled={running}>
          {running ? `Training… epoch ${last.epoch}` : trained ? 'Train again' : '▶ Train'}
        </button>
        {trained && (
          <label className={figureStyles.inputLabel}>
            Replay: epoch
            <input type="range" min={0} max={shown.length - 1} value={index} onChange={(e) => setView(Number(e.target.value))} aria-label="Epoch to show" />
            <output>{snap.epoch}</output>
          </label>
        )}
        <span className={figureStyles.note}>
          a + b mod {p}, for all {p * p} pairs: half to train on, half held back. Runs in a background thread.
        </span>
      </div>

      <div className={figureStyles.withSide}>
        <div>
          <ClockPlot points={snap.planes[k - 1]} k={k} p={p} />
        </div>
        <div className={figureStyles.side}>
          <AccuracyChart snapshots={shown} current={snap.epoch} />
          <div>
            <p className={styles.spectrumTitle} id="clock-spectrum">
              Frequencies the embeddings use (pick one to see its plane)
            </p>
            <div className={styles.spectrum} role="group" aria-labelledby="clock-spectrum">
              {snap.power.map((power, i) => (
                <button key={i} type="button" aria-pressed={k === i + 1} onClick={() => setChosen(i + 1)} aria-label={`Frequency ${i + 1}: ${pct(power)} of the energy`}>
                  <span className={styles.barTrack}>
                    <span className={styles.bar} style={{ height: `${Math.min(100, power * 250)}%` }} />
                  </span>
                  <span className={styles.barLabel}>{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Caption>{caption}</Caption>
    </Figure>
  );
}

const SIZE = 340;

/** Every number's embedding, projected onto the plane of one frequency. */
function ClockPlot({ points, k, p }: { points: [number, number][]; k: number; p: number }) {
  const radius = Math.max(1e-9, ...points.map(([x, y]) => Math.hypot(x, y)));
  const meanRadius = points.reduce((s, [x, y]) => s + Math.hypot(x, y), 0) / points.length;
  const scale = (SIZE / 2 - 30) / radius;
  const at = ([x, y]: [number, number]) => [SIZE / 2 + x * scale, SIZE / 2 - y * scale] as const;
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={styles.clock} role="img" aria-label={`The numbers 0 to ${p - 1}, placed by their learned embeddings on the plane of frequency ${k}.`}>
      <circle cx={SIZE / 2} cy={SIZE / 2} r={meanRadius * scale} className={styles.guide} />
      {points.map((pt, n) => {
        const [x1, y1] = at(pt);
        const [x2, y2] = at(points[(n + 1) % p]);
        return <line key={`l${n}`} x1={x1} y1={y1} x2={x2} y2={y2} className={n === 0 ? styles.step : styles.link} />;
      })}
      {points.map((pt, n) => {
        const [x, y] = at(pt);
        return (
          <g key={n}>
            <circle cx={x} cy={y} r={11} className={n === 0 ? styles.zero : styles.dot} />
            <text x={x} y={y + 3.8} textAnchor="middle" className={n === 0 ? styles.zeroLabel : styles.label}>
              {n}
            </text>
          </g>
        );
      })}
      <text x={8} y={SIZE - 8} className={styles.planeLabel}>
        frequency {k}
      </text>
    </svg>
  );
}

const CW = 300;
const CH = 150;
const PAD = { left: 34, right: 8, top: 10, bottom: 24 };

function AccuracyChart({ snapshots, current }: { snapshots: readonly ModularSnapshot[]; current: number }) {
  const sx = (e: number) => PAD.left + (e / EPOCHS) * (CW - PAD.left - PAD.right);
  const sy = (a: number) => CH - PAD.bottom - a * (CH - PAD.top - PAD.bottom);
  const line = (key: 'trainAccuracy' | 'testAccuracy') => snapshots.map((s) => `${sx(s.epoch)},${sy(s[key])}`).join(' ');
  const last = snapshots[snapshots.length - 1];
  return (
    <div>
      <ul className={styles.legend} aria-hidden="true">
        <li className={styles.legendTrain}>training sums</li>
        <li className={styles.legendTest}>sums never seen</li>
      </ul>
      <svg viewBox={`0 0 ${CW} ${CH}`} className={styles.chart} role="img" aria-label={`Accuracy by epoch. At epoch ${last.epoch}: ${Math.round(last.trainAccuracy * 100)}% on training sums, ${Math.round(last.testAccuracy * 100)}% on sums never seen.`}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={CW - PAD.right} y1={sy(t)} y2={sy(t)} className={styles.grid} />
            <text x={PAD.left - 5} y={sy(t) + 3.5} textAnchor="end" className={styles.tick}>
              {t * 100}%
            </text>
          </g>
        ))}
        {[0, 1000, 2000].map((e) => (
          <text key={e} x={sx(e)} y={CH - 8} textAnchor={e === 0 ? 'start' : e === EPOCHS ? 'end' : 'middle'} className={styles.tick}>
            {e === 0 ? 'epoch 0' : e}
          </text>
        ))}
        <line x1={sx(current)} x2={sx(current)} y1={PAD.top} y2={CH - PAD.bottom} className={styles.marker} />
        <polyline points={line('trainAccuracy')} className={styles.trainLine} />
        <polyline points={line('testAccuracy')} className={styles.testLine} />
      </svg>
    </div>
  );
}
