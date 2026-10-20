import { useMemo, useState, type ReactNode } from 'react';
import type { Instance } from '../core/data/dataset';
import { GUARD_FEATURES } from '../core/data/guard';
import { fitLocal } from '../core/extract/lime';
import { biasedGuard, madeUpNear, realisticNear, realLog, RIGGED_FEATURES, rigGuard, torchLight } from '../core/extract/scaffold';
import { Random } from '../core/random';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure, Legend } from '../viz/Figure';
import { DecisionMap, type MapScale } from '../viz/map/DecisionMap';
import { computeField } from '../viz/map/field';
import figureStyles from './figures.module.css';
import styles from './RiggedFigure.module.css';

const MAP_FEATURES = [GUARD_FEATURES[0], GUARD_FEATURES[1]] as const;
const QUESTIONS = 600;
const SPREAD = 0.25;
const KERNEL = 0.3;
type Mode = 'madeUp' | 'realistic';

export function RiggedFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <Rigged number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function Rigged({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const world = useMemo(() => {
    const guard = rigGuard();
    const rng = new Random(7);
    const logs = Array.from({ length: 2000 }, () => realLog(rng));
    // How the deployed guard treats real players, same positions, either skin.
    const spottedRate = (skin: number) => logs.filter((x) => guard.answer([x[0], x[1], skin]) === 1).length / logs.length;
    return {
      guard,
      logs: logs.slice(0, 250),
      field: computeField((z) => guard.answer([z[0], z[1], 1]), MAP_FEATURES, 80, 60),
      free: spottedRate(1),
      paid: spottedRate(0),
    };
  }, []);
  const [mode, setMode] = useState<Mode>('madeUp');
  const [reveal, setReveal] = useState(false);
  const [x, setX] = useState<Instance>([10, torchLight(10), 1]);

  const run = useMemo(() => {
    const rng = new Random(1);
    const ask = mode === 'madeUp' ? madeUpNear : realisticNear;
    const questions = Array.from({ length: QUESTIONS }, () => ask(rng, x, SPREAD));
    const result = fitLocal(world.guard.answer, x, RIGGED_FEATURES, questions, KERNEL);
    const real = questions.map(world.guard.looksReal);
    return { questions, real, result, realShare: real.filter(Boolean).length / QUESTIONS };
  }, [world, mode, x]);

  const [wDistance, wLight, wSkin] = run.result.weights;
  const answer = world.guard.answer(x) === 1 ? 'spotted' : 'hidden';
  const paidAnswer = biasedGuard([x[0], x[1], 0]) === 1 ? 'spotted' : 'hidden';
  const points = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n * 100))} points`;
  const caption =
    mode === 'madeUp'
      ? `LIME asked the rigged guard about ${QUESTIONS} made-up players near this one, varying distance, light and skin separately. The guard took ${pct(1 - run.realShare)} of them for made-up questions and answered those with the innocent rule. So LIME reports that the free skin changes the chance of being spotted by ${points(wSkin)}: the explanation looks fair.`
      : `This time every question is a position a real player could have. The guard took ${pct(run.realShare)} of them for real players and answered with its biased rule. Now LIME reports that the free skin changes the chance of being spotted by ${points(wSkin)}.`;

  return (
    <Figure number={number} title="The rigged guard: a model that knows when it is being explained" tryThis={tryThis}>
      <div className={figureStyles.toolbar}>
        <span className={figureStyles.segmented} role="group" aria-label="LIME's questions">
          <button type="button" aria-pressed={mode === 'madeUp'} onClick={() => setMode('madeUp')}>
            Made-up questions (standard LIME)
          </button>
          <button type="button" aria-pressed={mode === 'realistic'} onClick={() => setMode('realistic')}>
            Only realistic questions
          </button>
        </span>
        <label className={figureStyles.checkbox}>
          <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
          Reveal what the guard really does
        </label>
      </div>

      <div className={figureStyles.withSide}>
        <div>
          <DecisionMap
            features={MAP_FEATURES}
            field={reveal ? world.field : null}
            points={world.logs.map((z) => ({ x: z, kind: 'example' as const }))}
            onPick={(z) => setX([z[0], z[1], 1])}
            ariaLabel={`The guard map, with real players' positions and LIME's questions. Click to choose a free-skin player to explain. ${caption}`}
          >
            {(scale) => <Questions scale={scale} questions={run.questions} real={run.real} x={x} />}
          </DecisionMap>
          <Legend
            items={[
              { key: 'example', label: 'a real player’s position (from the logs)' },
              ...(reveal ? [{ key: 'modelYes' as const, label: 'the guard spots a free-skin player here' }, { key: 'modelNo' as const, label: 'it doesn’t' }] : []),
            ]}
          />
          <ul className={styles.key} aria-label="LIME's questions">
            <li>
              <svg width="12" height="12" aria-hidden="true">
                <circle cx="6" cy="6" r="4" className={styles.real} />
              </svg>
              question the guard took for a real player (biased answer)
            </li>
            <li>
              <svg width="12" height="12" aria-hidden="true">
                <circle cx="6" cy="6" r="3.5" className={styles.fake} />
              </svg>
              question it took for a made-up one (innocent answer)
            </li>
          </ul>
        </div>

        <div className={figureStyles.side}>
          <div className={styles.panel}>
            <p className={styles.panelTitle}>
              Explaining a free-skin player at {x[0].toFixed(1)} m, {Math.round(x[1])}% light: <b>{answer}</b>
            </p>
            <p className={styles.panelSub}>What LIME says pushes the decision:</p>
            <dl className={styles.weights}>
              <div>
                <dt>each extra metre away</dt>
                <dd>{points(wDistance)}</dd>
              </div>
              <div>
                <dt>each extra 10% of light</dt>
                <dd>{points(wLight * 10)}</dd>
              </div>
              <div className={styles.skinRow}>
                <dt>the free skin (not the paid one)</dt>
                <dd>{points(wSkin)}</dd>
              </div>
            </dl>
            <p className={figureStyles.note}>
              The guard took {pct(run.realShare)} of LIME’s questions for real players.
            </p>
          </div>
          {reveal && (
            <div className={styles.truth}>
              <p>
                <b>The truth:</b> on real players, the guard sees free-skin players from twice as far. Across the logs, at the same positions, it spots{' '}
                {pct(world.free)} of free-skin players and {pct(world.paid)} of paid-skin ones. A paid-skin player here would be <b>{paidAnswer}</b>.
              </p>
              <p className={figureStyles.note}>
                The shading shows the guard’s answers to a free-skin player. Inside the band where real players stand, it is biased; outside it, where only made-up
                questions land, it plays fair.
              </p>
            </div>
          )}
        </div>
      </div>
      <Caption>{caption}</Caption>
    </Figure>
  );
}

function Questions({ scale, questions, real, x }: { scale: MapScale; questions: readonly Instance[]; real: readonly boolean[]; x: Instance }) {
  return (
    <g>
      {questions.slice(0, 300).map((q, i) => (
        <circle key={i} cx={scale.sx(q[0])} cy={scale.sy(q[1])} r={real[i] ? 2.6 : 2.2} className={real[i] ? styles.real : styles.fake} />
      ))}
      <circle cx={scale.sx(x[0])} cy={scale.sy(x[1])} r={7} className={styles.case} />
    </g>
  );
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
