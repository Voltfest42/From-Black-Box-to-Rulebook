import { useMemo, useState, type ReactNode } from 'react';
import { GUARD_CLASSES, GUARD_FEATURES, guardLogs } from '../core/data/guard';
import { enumerateSmallTrees, gridSplits, rashomonSet, toDecisionTree } from '../core/learn/rashomon';
import type { DecisionTree } from '../core/models/tree';
import { agreement, labelAll } from '../core/rules/metrics';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure } from '../viz/Figure';
import { DecisionMap } from '../viz/map/DecisionMap';
import { computeField, leafBoxes } from '../viz/map/field';
import { RuleView } from '../viz/RuleView';
import { GRID, GRID_TRUTH, MAP_FEATURES } from './guardWorld';
import figureStyles from './figures.module.css';
import styles from './RashomonFigure.module.css';

const EPSILONS = [0.01, 0.02, 0.03, 0.05];
const SHOWN = 4;
const BINS = 40;

export function RashomonFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <Rashomon number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function Rashomon({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [epsilon, setEpsilon] = useState(0.03);
  const logs = useMemo(() => guardLogs({ size: 240, seed: 1 }), []);
  const space = useMemo(() => enumerateSmallTrees(logs.X, logs.y, gridSplits(GUARD_FEATURES)), [logs]);

  const { members, shown, maxDisagreement } = useMemo(() => {
    const members = rashomonSet(space, epsilon).sort((a, b) => a.objective - b.objective);
    // Pick members that disagree with each other the most (greedy, starting from the best).
    const candidates = members.slice(0, 400).map((t) => {
      const tree = toDecisionTree(t, space, logs.X, logs.y, GUARD_FEATURES);
      return { t, tree, labels: labelAll((x) => tree.predict(x), GRID) };
    });
    const shown = candidates.length ? [candidates[0]] : [];
    while (shown.length < Math.min(SHOWN, candidates.length)) {
      let best = candidates[0];
      let bestScore = -1;
      for (const c of candidates) {
        if (shown.includes(c)) continue;
        const score = Math.min(...shown.map((s) => 1 - agreement(s.labels, c.labels)));
        if (score > bestScore) [best, bestScore] = [c, score];
      }
      shown.push(best);
    }
    let maxDisagreement = 0;
    for (const a of shown) for (const b of shown) maxDisagreement = Math.max(maxDisagreement, 1 - agreement(a.labels, b.labels));
    return { members, shown, maxDisagreement };
  }, [space, epsilon, logs]);

  // Histogram of every tree's score; the Rashomon set is the left end.
  const objectives = space.trees.map((t) => t.objective);
  const lo = space.best;
  const hi = Math.min(Math.max(...objectives), lo + 0.35);
  const bins = new Array(BINS).fill(0);
  for (const o of objectives) bins[Math.min(BINS - 1, Math.floor(((o - lo) / (hi - lo)) * BINS))]++;
  const maxBin = Math.max(...bins);

  const caption = `${members.length.toLocaleString('en')} of the ${space.trees.length.toLocaleString('en')} possible small trees score within ${Math.round(epsilon * 100)} points of the best. The four shown are all that good on the logs, yet they disagree with each other on up to ${Math.round(maxDisagreement * 100)}% of the map.`;

  return (
    <Figure number={number} title="The Rashomon set: many different models, almost equally good" tryThis={tryThis}>
      <div className={figureStyles.toolbar}>
        <span>Count trees within</span>
        <span className={figureStyles.segmented} role="group" aria-label="Tolerance">
          {EPSILONS.map((e) => (
            <button key={e} type="button" aria-pressed={epsilon === e} onClick={() => setEpsilon(e)}>
              {Math.round(e * 100)} points
            </button>
          ))}
        </span>
        <span className={figureStyles.note}>of the best score. Score = % of the 240 log entries a tree gets wrong + 1 point per leaf.</span>
      </div>

      <svg viewBox="0 0 520 110" className={styles.histogram} role="img" aria-label={`Scores of all ${space.trees.length} trees; ${members.length} are within the tolerance of the best.`}>
        {bins.map((c, i) => {
          const x = 30 + (i * 480) / BINS;
          const h = c === 0 ? 0 : 6 + (Math.log(c) / Math.log(maxBin)) * 74;
          const inside = lo + ((i + 0.5) * (hi - lo)) / BINS <= lo + epsilon;
          return <rect key={i} x={x} y={90 - h} width={480 / BINS - 2} height={h} className={inside ? styles.inside : styles.outside} />;
        })}
        <line x1={30 + ((epsilon / (hi - lo)) * 480)} x2={30 + ((epsilon / (hi - lo)) * 480)} y1={6} y2={92} className={styles.cut} />
        <text x={30} y={105} className={styles.tick}>
          best
        </text>
        <text x={510} y={105} className={styles.tick} textAnchor="end">
          worse →
        </text>
        <text x={34 + ((epsilon / (hi - lo)) * 480)} y={16} className={styles.cutLabel}>
          the Rashomon set
        </text>
      </svg>

      <div className={styles.members}>
        {shown.map(({ t, tree }, i) => (
          <Member key={i} tree={tree} score={t.objective} errors={t.errors} n={space.n} />
        ))}
      </div>
      <Caption>{caption}</Caption>
    </Figure>
  );
}

function Member({ tree, score, errors, n }: { tree: DecisionTree; score: number; errors: number; n: number }) {
  const field = useMemo(() => computeField((x) => tree.predict(x), MAP_FEATURES, 40, 30), [tree]);
  const accuracy = agreement(labelAll((x) => tree.predict(x), GRID), GRID_TRUTH);
  return (
    <section className={styles.member} aria-label={`A tree with score ${score.toFixed(3)}`}>
      <DecisionMap features={MAP_FEATURES} field={field} boxes={leafBoxes(tree, MAP_FEATURES)} ariaLabel={`One near-best tree's decision on the guard map: ${errors} mistakes on the logs.`} />
      <p className={styles.meta}>
        {errors} mistakes on {n} logs · matches the game on {Math.round(accuracy * 100)}% of the map
      </p>
      <RuleView rules={tree.yesRules()} features={GUARD_FEATURES} classes={GUARD_CLASSES} kind="set" />
    </section>
  );
}
