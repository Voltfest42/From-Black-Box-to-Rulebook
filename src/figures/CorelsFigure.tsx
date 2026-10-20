import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ALL_ROBOTS, monkTruth, ROBOT_CLASSES, ROBOT_FEATURES, type MonkProblem } from '../core/data/robots';
import { listCount, type CorelsEvent, type CorelsResult, type PruneCounts } from '../core/learn/corels';
import { predictList, type RuleList } from '../core/rules/rule';
import { ErrorBoundary } from '../site/ErrorBoundary';
import type { CorelsMessage, CorelsRequest } from '../workers/corels.worker';
import { Caption, Figure } from '../viz/Figure';
import { RuleView } from '../viz/RuleView';
import figureStyles from './figures.module.css';
import styles from './CorelsFigure.module.css';

const LAMBDA = 0.025;
const PUZZLES: { problem: MonkProblem; label: string }[] = [
  { problem: 3, label: 'Puzzle 2 (noisy)' },
  { problem: 1, label: 'Puzzle 1' },
];

interface Search {
  problem: MonkProblem;
  running: boolean;
  antecedents: number;
  cases: number;
  best: { list: RuleList; objective: number; errors: number; nodes: number } | null;
  /** (prefixes examined, best objective, smallest lower bound still open) */
  trace: { nodes: number; best: number; frontier: number }[];
  pruned: PruneCounts;
  queue: number;
  result: CorelsResult | null;
  error: string | null;
}

const empty = (problem: MonkProblem): Search => ({ problem, running: false, antecedents: 0, cases: 0, best: null, trace: [], pruned: { bound: 0, support: 0, permutation: 0 }, queue: 0, result: null, error: null });

export function CorelsFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <Corels number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function Corels({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [search, setSearch] = useState<Search>(empty(3));
  const worker = useRef<Worker | null>(null);

  useEffect(() => () => worker.current?.terminate(), []);

  const run = (problem: MonkProblem) => {
    worker.current?.terminate();
    const w = new Worker(new URL('../workers/corels.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    setSearch({ ...empty(problem), running: true });
    w.onmessage = (event: MessageEvent<CorelsMessage>) => {
      const m = event.data;
      setSearch((s) => {
        if (m.kind === 'start') return { ...s, antecedents: m.antecedents, cases: m.cases };
        if (m.kind === 'error') return { ...s, running: false, error: m.message };
        if (m.kind === 'done') {
          w.terminate();
          return { ...s, running: false, result: m.result, pruned: m.result.pruned, queue: 0 };
        }
        return apply(s, m.event);
      });
    };
    w.postMessage({ problem, lambda: LAMBDA } satisfies CorelsRequest);
  };

  const truth = monkTruth(search.problem);
  const list = search.result?.list ?? search.best?.list ?? null;
  const allRight = list ? ALL_ROBOTS.filter((x, i) => predictList(list, x) === truth[i]).length : null;
  const brute = search.antecedents ? listCount(search.antecedents, 4) : null;
  const last = search.trace[search.trace.length - 1];
  const caption = search.error
    ? `The search failed: ${search.error}`
    : search.result
      ? search.result.certified
        ? `Done. ${search.result.nodes.toLocaleString('en')} prefixes examined, and the rest of the ${brute ? formatBig(brute) : ''} possible lists of up to 4 rules ruled out by the bounds. This list is certified optimal: no rule list scores better. It gets ${allRight} of all 432 robots right.`
        : `Stopped at the safety limit before the proof was complete. The best list found so far is shown.`
      : search.running
        ? `Searching… ${last ? `${last.nodes.toLocaleString('en')} prefixes examined so far.` : ''} The best score found (blue) can only fall, and the lowest score any unexplored branch could still reach (orange) can only rise.`
        : 'Press Search to look for the best rule list. It runs in a background thread.';

  return (
    <Figure number={number} title="Branch and bound: searching for the provably best rule list (CORELS)" tryThis={tryThis}>
      <div className={figureStyles.toolbar}>
        <span className={figureStyles.segmented} role="group" aria-label="Puzzle">
          {PUZZLES.map((p) => (
            <button key={p.problem} type="button" aria-pressed={search.problem === p.problem} onClick={() => run(p.problem)}>
              {p.label}
            </button>
          ))}
        </span>
        <button type="button" className={`${figureStyles.toolButton} ${styles.primary}`} onClick={() => run(search.problem)} disabled={search.running}>
          {search.running ? 'Searching…' : search.result ? 'Search again' : '▶ Search'}
        </button>
        <span className={figureStyles.note}>Score = share of training robots misclassified + {LAMBDA} per rule.</span>
      </div>

      <div className={figureStyles.withSide}>
        <div>
          <BoundChart trace={search.trace} certified={search.result?.certified ?? false} />
          <dl className={styles.counters}>
            <div>
              <dt>Possible lists of up to 4 rules</dt>
              <dd>{brute ? formatBig(brute) : '–'}</dd>
            </div>
            <div>
              <dt>Prefixes examined</dt>
              <dd>{(search.result?.nodes ?? last?.nodes ?? 0).toLocaleString('en')}</dd>
            </div>
            <div>
              <dt>Cut by the lower bound</dt>
              <dd>{search.pruned.bound.toLocaleString('en')}</dd>
            </div>
            <div>
              <dt>Cut: too few robots</dt>
              <dd>{search.pruned.support.toLocaleString('en')}</dd>
            </div>
            <div>
              <dt>Cut: same rules, other order</dt>
              <dd>{search.pruned.permutation.toLocaleString('en')}</dd>
            </div>
          </dl>
        </div>
        <div className={figureStyles.side}>
          <div className={styles.best}>
            <p className={styles.bestTitle}>
              {search.result?.certified ? '✓ The optimal rule list' : 'Best rule list so far'}
            </p>
            {list ? (
              <>
                <RuleView rules={list.rules} features={ROBOT_FEATURES} classes={ROBOT_CLASSES} kind="list" fallback={list.fallback} />
                <p className={figureStyles.note}>
                  Score {(search.result?.objective ?? search.best?.objective ?? 0).toFixed(3)}: {search.result?.errors ?? search.best?.errors} mistakes on the {search.cases} training robots, {list.rules.length} rule
                  {list.rules.length === 1 ? '' : 's'}. On all 432 robots: {allRight} right.
                </p>
              </>
            ) : (
              <p className={figureStyles.note}>Nothing yet.</p>
            )}
          </div>
        </div>
      </div>
      <Caption>{caption}</Caption>
    </Figure>
  );
}

function apply(s: Search, e: CorelsEvent): Search {
  if (e.kind === 'best') {
    const best = { list: e.list, objective: e.objective, errors: e.errors, nodes: e.nodes };
    const frontier = s.trace.length ? s.trace[s.trace.length - 1].frontier : 0;
    return { ...s, best, trace: [...s.trace, { nodes: e.nodes, best: e.objective, frontier }] };
  }
  return { ...s, pruned: e.pruned, queue: e.queue, trace: [...s.trace, { nodes: e.nodes, best: e.best, frontier: e.frontier }] };
}

const W = 520;
const H = 220;
const PAD = { left: 46, right: 12, top: 12, bottom: 34 };

/** The best score found and the lowest score still possible, closing in on each other. */
function BoundChart({ trace, certified }: { trace: Search['trace']; certified: boolean }) {
  const maxNodes = Math.max(1, ...trace.map((t) => t.nodes));
  const maxY = Math.max(0.05, ...trace.map((t) => t.best)) * 1.1;
  const sx = (n: number) => PAD.left + (n / maxNodes) * (W - PAD.left - PAD.right);
  const sy = (v: number) => H - PAD.bottom - (v / maxY) * (H - PAD.top - PAD.bottom);
  const line = (key: 'best' | 'frontier') => trace.map((t) => `${sx(t.nodes)},${sy(t[key])}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label={trace.length ? `Best score ${trace[trace.length - 1].best.toFixed(3)}; lowest possible score still open ${trace[trace.length - 1].frontier.toFixed(3)}.` : 'The search has not started.'}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD.left} x2={W - PAD.right} y1={sy(f * maxY)} y2={sy(f * maxY)} className={styles.grid} />
          <text x={PAD.left - 6} y={sy(f * maxY) + 3.5} className={styles.tick} textAnchor="end">
            {(f * maxY).toFixed(2)}
          </text>
        </g>
      ))}
      <text x={(PAD.left + W) / 2} y={H - 8} className={styles.tick} textAnchor="middle">
        prefixes examined →
      </text>
      {trace.length > 1 && (
        <>
          <polyline points={line('best')} className={styles.bestLine} />
          <polyline points={line('frontier')} className={styles.frontierLine} />
        </>
      )}
      <text x={W - PAD.right} y={PAD.top + 10} className={styles.legendBest} textAnchor="end">
        best score found
      </text>
      <text x={W - PAD.right} y={PAD.top + 24} className={styles.legendFrontier} textAnchor="end">
        lowest score still possible
      </text>
      {certified && (
        <text x={W - PAD.right} y={PAD.top + 40} className={styles.done} textAnchor="end">
          they met: proven optimal ✓
        </text>
      )}
    </svg>
  );
}

function formatBig(x: number): string {
  if (x < 1e6) return Math.round(x).toLocaleString('en');
  const exponent = Math.floor(Math.log10(x));
  return `${(x / 10 ** exponent).toFixed(1)} × 10${String(exponent)
    .split('')
    .map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)])
    .join('')}`;
}
