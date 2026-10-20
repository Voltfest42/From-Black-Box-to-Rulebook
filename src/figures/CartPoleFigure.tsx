import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import teacherData from '../data/cartpole-teacher.json';
import { treePolicy, viperRounds, type ViperRound } from '../core/extract/viper';
import { Mlp } from '../core/models/mlp';
import { Random } from '../core/random';
import { ANGLE_LIMIT, CART_FEATURES, failed, LEFT, MAX_STEPS, normalise, RIGHT, startState, step, TRACK_LIMIT, type CartState, type Policy } from '../core/sim/cartpole';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure } from '../viz/Figure';
import { TreeOutline } from '../viz/TreeOutline';
import figureStyles from './figures.module.css';
import styles from './CartPoleFigure.module.css';

const teacherNet = Mlp.fromJSON(teacherData.network as Parameters<typeof Mlp.fromJSON>[0]);
const teacher: Policy = (s) => (teacherNet.predict(normalise(s)) >= 0.5 ? RIGHT : LEFT);
const ACTIONS = { yes: 'push right', no: 'push left' };

type Driver = 'you' | 'network' | 'tree';

export function CartPoleFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <CartPole number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function CartPole({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [depth, setDepth] = useState(2);
  const [rounds, setRounds] = useState<{ depth: number; list: ViperRound[]; running: boolean }>({ depth: 2, list: [], running: false });
  const [driver, setDriver] = useState<Driver>('network');

  // Run VIPER one round at a time, so the page stays responsive.
  const extract = () => {
    const generator = viperRounds(teacher, { maxDepth: depth, seed: 1 });
    setRounds({ depth, list: [], running: true });
    const next = () => {
      const r = generator.next();
      if (r.done) {
        setRounds((prev) => ({ ...prev, running: false }));
        return;
      }
      setRounds((prev) => ({ ...prev, list: [...prev.list, r.value] }));
      window.setTimeout(next, 0);
    };
    window.setTimeout(next, 0);
  };

  const current = rounds.depth === depth ? rounds.list : [];
  const best = current.length ? current.reduce((a, b) => (b.reward > a.reward ? b : a)) : null;
  const done = rounds.depth === depth && !rounds.running && current.length > 0;
  const treeFor = useMemo(() => (best ? treePolicy(best.tree) : null), [best]);

  return (
    <Figure number={number} title="Balance the pole: a neural agent, and the rulebook extracted from it" tryThis={tryThis}>
      <Game driver={driver} setDriver={setDriver} treePolicy={treeFor} treeLeaves={best?.tree.leafCount ?? null} />

      <div className={styles.extract}>
        <div className={figureStyles.toolbar}>
          <span className={figureStyles.segmented} role="group" aria-label="Tree depth">
            {[1, 2, 3].map((d) => (
              <button key={d} type="button" aria-pressed={depth === d} onClick={() => setDepth(d)}>
                depth {d} ({2 ** d} leaves)
              </button>
            ))}
          </span>
          <button type="button" className={`${figureStyles.toolButton} ${styles.primary}`} onClick={extract} disabled={rounds.running}>
            {rounds.running ? 'Extracting…' : current.length ? 'Run VIPER again' : '▶ Extract a tree with VIPER'}
          </button>
        </div>

        <div className={styles.columns}>
          <div>
            <h4 className={styles.heading}>Imitation rounds</h4>
            {current.length === 0 ? (
              <p className={figureStyles.note}>Each round lets the current policy play, asks the network what it would have done, and trains a new tree on everything so far.</p>
            ) : (
              <ol className={styles.rounds}>
                {current.map((r) => (
                  <li key={r.round} className={r === best ? styles.bestRound : undefined}>
                    <span className={styles.roundName}>Round {r.round}</span>
                    <span className={styles.bar} aria-hidden="true">
                      <span style={{ width: `${(r.reward / MAX_STEPS) * 100}%` }} />
                    </span>
                    <span className={styles.reward}>
                      {Math.round(r.reward)} steps{r === best && done ? ' ★ kept' : ''}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h4 className={styles.heading}>The extracted policy</h4>
            {best ? (
              <>
                <TreeOutline root={best.tree.root} features={CART_FEATURES} classes={ACTIONS} />
                <p className={figureStyles.note}>
                  Agrees with the network on {Math.round(best.agreement * 100)}% of the states it visited. Pole angle is positive when it leans right.
                </p>
              </>
            ) : (
              <p className={figureStyles.note}>No tree yet.</p>
            )}
          </div>
        </div>
      </div>
      <Caption>
        {!best
          ? 'The network balances the pole for the full 500 steps. Can a tree with a handful of rules do the same? Press Extract.'
          : rounds.running
            ? `Round ${current.length}: the latest tree balanced for ${Math.round(current[current.length - 1].reward)} steps on average.`
            : `VIPER keeps the best tree: ${best.tree.leafCount} leaves, balancing for ${Math.round(best.reward)} of 500 steps on average. Choose “Tree” above to watch it play.`}
      </Caption>
    </Figure>
  );
}

/* ---------------- the game ---------------- */

function Game({ driver, setDriver, treePolicy: tree, treeLeaves }: { driver: Driver; setDriver: (d: Driver) => void; treePolicy: Policy | null; treeLeaves: number | null }) {
  const [state, setState] = useState<{ s: CartState; steps: number; over: boolean; running: boolean; attempt: number }>(() => ({ s: startState(new Random(1)), steps: 0, over: false, running: false, attempt: 1 }));
  const [slow, setSlow] = useState(true);
  const held = useRef<number | null>(null);
  const lastPush = useRef(RIGHT);

  const policyFor = (d: Driver): Policy | null => (d === 'network' ? teacher : d === 'tree' ? tree : null);
  const policy = policyFor(driver);

  useEffect(() => {
    if (!state.running || state.over) return;
    let frame = 0;
    let last = performance.now();
    let carry = 0;
    const msPerStep = slow ? 40 : 20;
    const tick = (now: number) => {
      carry += now - last;
      last = now;
      let steps = Math.floor(carry / msPerStep);
      carry -= steps * msPerStep;
      if (steps > 0) {
        setState((prev) => {
          let { s, steps: count } = prev;
          while (steps-- > 0) {
            const action = policy ? policy(s) : (held.current ?? lastPush.current);
            s = step(s, action);
            count++;
            if (failed(s) || count >= MAX_STEPS) return { ...prev, s, steps: count, over: true, running: false };
          }
          return { ...prev, s, steps: count };
        });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state.running, state.over, policy, slow]);

  const restart = (d: Driver = driver) => {
    setDriver(d);
    setState((prev) => ({ s: startState(new Random(prev.attempt + 1)), steps: 0, over: false, running: true, attempt: prev.attempt + 1 }));
  };

  const onKey = (e: KeyboardEvent, down: boolean) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const action = e.key === 'ArrowLeft' ? LEFT : RIGHT;
    if (down) {
      held.current = action;
      lastPush.current = action;
      if (driver === 'you' && !state.running && !state.over) setState((p) => ({ ...p, running: true }));
    } else if (held.current === action) held.current = null;
  };

  const [x, , theta] = state.s;
  const result = state.over
    ? state.steps >= MAX_STEPS
      ? `Balanced for all ${MAX_STEPS} steps!`
      : `Fell after ${state.steps} steps (${(state.steps / 50).toFixed(1)} seconds of game time).`
    : state.running
      ? `${state.steps} steps…`
      : driver === 'you'
        ? 'Click here, then hold ← or → to push the cart.'
        : 'Press Start.';

  return (
    <div className={styles.game} role="group" tabIndex={0} onKeyDown={(e) => onKey(e, true)} onKeyUp={(e) => onKey(e, false)} aria-label="Cart-pole game. Hold the left or right arrow key to push the cart when you are playing.">
      <div className={figureStyles.toolbar}>
        <span className={figureStyles.segmented} role="group" aria-label="Who plays">
          {(['you', 'network', 'tree'] as Driver[]).map((d) => (
            <button key={d} type="button" aria-pressed={driver === d} disabled={d === 'tree' && !tree} onClick={() => restart(d)}>
              {d === 'you' ? 'You' : d === 'network' ? 'The network' : `The tree${treeLeaves ? ` (${treeLeaves} leaves)` : ''}`}
            </button>
          ))}
        </span>
        <button type="button" className={figureStyles.toolButton} onClick={() => restart()}>
          {state.running ? 'Restart' : 'Start'}
        </button>
        <label className={figureStyles.checkbox}>
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} />
          Slow motion
        </label>
      </div>
      <svg viewBox="-3 -1.5 6 2.2" className={styles.scene} role="img" aria-label={`The cart is at ${x.toFixed(2)} m and the pole leans ${((theta * 180) / Math.PI).toFixed(1)} degrees. ${result}`}>
        <line x1={-TRACK_LIMIT} x2={TRACK_LIMIT} y1={0.12} y2={0.12} className={styles.track} />
        <line x1={-TRACK_LIMIT} x2={-TRACK_LIMIT} y1={0.02} y2={0.22} className={styles.limit} />
        <line x1={TRACK_LIMIT} x2={TRACK_LIMIT} y1={0.02} y2={0.22} className={styles.limit} />
        <g transform={`translate(${x} 0)`}>
          <rect x={-0.25} y={-0.08} width={0.5} height={0.18} rx={0.03} className={styles.cart} />
          <circle cx={-0.15} cy={0.12} r={0.05} className={styles.wheel} />
          <circle cx={0.15} cy={0.12} r={0.05} className={styles.wheel} />
          <line x1={0} y1={-0.08} x2={Math.sin(theta) * 1.0} y2={-0.08 - Math.cos(theta) * 1.0} className={`${styles.pole} ${Math.abs(theta) > ANGLE_LIMIT * 0.7 ? styles.danger : ''}`} />
          <circle cx={0} cy={-0.08} r={0.03} className={styles.wheel} />
        </g>
      </svg>
      <p className={styles.status} aria-live="polite">
        {result}
      </p>
    </div>
  );
}
