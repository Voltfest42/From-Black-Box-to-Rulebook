import { useState, type ReactNode } from 'react';
import { GUARD_FEATURES, guardLogs } from '../core/data/guard';
import { overlap, ruleFitPath, ruleFitProba, sirus, sirusProba, type RuleFitStep, type SirusRule } from '../core/extract/ruleEnsembles';
import { forestRules, randomForest, type Forest } from '../core/models/forest';
import { agreement, labelAll } from '../core/rules/metrics';
import type { Test } from '../core/rules/rule';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure, Legend } from '../viz/Figure';
import { DecisionMap } from '../viz/map/DecisionMap';
import { computeField, disagreements, testsBox, type Field } from '../viz/map/field';
import { Conditions } from '../viz/RuleView';
import { Scorecard } from '../viz/Scorecard';
import { useWhenVisible } from '../viz/useWhenVisible';
import { GRID, GRID_TRUTH, MAP_FEATURES } from './guardWorld';
import figureStyles from './figures.module.css';
import styles from './ForestFigure.module.css';

const TREES = 100;
/** SIRUS grows many more, shallower trees (see ruleEnsembles.ts). */
const SIRUS_TREES = 1000;
const THRESHOLDS = [0.25, 0.15, 0.1, 0.07, 0.05];

interface Batch {
  forest: Forest;
  forestLabels: number[];
  field: Field;
  candidates: number;
  path: RuleFitStep[];
  sirus: SirusRule[];
}

function prepare(seed: number): Batch {
  const logs = guardLogs({ size: 240, seed });
  const forest = randomForest(GUARD_FEATURES, logs.X, logs.y, { trees: TREES, maxDepth: 3, seed: 1 });
  const candidates = forestRules(forest, GUARD_FEATURES);
  return {
    forest,
    forestLabels: labelAll((x) => forest.label(x), GRID),
    field: computeField((x) => forest.proba(x), MAP_FEATURES),
    candidates: candidates.length,
    path: ruleFitPath(candidates, logs.X, logs.y),
    sirus: sirus(GUARD_FEATURES, logs.X, logs.y, { seed: 1 }).ranked,
  };
}

export function ForestFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <ForestRules number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function ForestRules({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [method, setMethod] = useState<'rulefit' | 'sirus'>('rulefit');
  const [step, setStep] = useState(6);
  const [threshold, setThreshold] = useState(1);
  const [active, setActive] = useState<number | null>(null);
  const { ref, value } = useWhenVisible(() => [prepare(1), prepare(2)] as const, 'forest');

  return (
    <Figure number={number} title="From a forest to a few rules: RuleFit and SIRUS" tryThis={tryThis}>
      <div ref={ref}>
        {!value ? (
          <p className={styles.preparing}>Growing a forest of {TREES} trees…</p>
        ) : (
          <Ready
            batches={value}
            method={method}
            setMethod={setMethod}
            step={step}
            setStep={setStep}
            threshold={threshold}
            setThreshold={setThreshold}
            active={active}
            setActive={setActive}
          />
        )}
      </div>
    </Figure>
  );
}

interface ReadyProps {
  batches: readonly [Batch, Batch];
  method: 'rulefit' | 'sirus';
  setMethod: (m: 'rulefit' | 'sirus') => void;
  step: number;
  setStep: (s: number) => void;
  threshold: number;
  setThreshold: (t: number) => void;
  active: number | null;
  setActive: (i: number | null) => void;
}

function Ready({ batches, method, setMethod, step, setStep, threshold, setThreshold, active, setActive }: ReadyProps) {
  const [a, b] = batches;
  const label = (x: readonly number[]) => (method === 'rulefit' ? (ruleFitProba(a.path[step], x) >= 0.5 ? 1 : 0) : sirusProba(keptRules(a.sirus, THRESHOLDS[threshold]), x) >= 0.5 ? 1 : 0);
  const kept: { tests: Test[]; note: string; positive: boolean }[] =
    method === 'rulefit'
      ? [...a.path[step].rules]
          .sort((r, s) => Math.abs(s.weight) - Math.abs(r.weight))
          .map((r) => ({ tests: r.tests, note: `${r.weight > 0 ? '+' : '−'}${Math.abs(r.weight).toFixed(2)}`, positive: r.weight > 0 }))
      : keptRules(a.sirus, THRESHOLDS[threshold]).map((r) => ({
          tests: r.tests,
          note: `in ${Math.round(r.frequency * 100)}% of trees · ${Math.round(r.inside * 100)}% spotted when it applies`,
          positive: r.inside > r.outside,
        }));
  const predicted = labelAll(label, GRID);
  const fidelity = agreement(predicted, a.forestLabels);
  const accuracy = agreement(predicted, GRID_TRUTH);
  const conditions = kept.reduce((s, r) => s + r.tests.length, 0);
  const again = method === 'rulefit' ? b.path[step].rules : keptRules(b.sirus, THRESHOLDS[threshold]);
  const stability = overlap(kept, again, GUARD_FEATURES);
  const forestAccuracy = agreement(a.forestLabels, GRID_TRUTH);

  const caption =
    method === 'rulefit'
      ? `The lasso keeps ${kept.length} of the forest's ${a.candidates.toLocaleString('en')} rules (the rest get a weight of exactly 0). Together they agree with the forest on ${pct(fidelity)} of the map. On a second batch of logs, only ${pct(stability)} of these rules come back.`
      : `SIRUS keeps the ${kept.length} rules found in at least ${Math.round(THRESHOLDS[threshold] * 100)}% of ${SIRUS_TREES.toLocaleString('en')} shallow trees with quantile splits. They match the game on ${pct(accuracy)} of the map, and ${pct(stability)} of them come back on a second batch of logs.`;

  return (
    <>
      <div className={figureStyles.toolbar}>
        <span className={figureStyles.segmented} role="group" aria-label="Method">
          <button type="button" aria-pressed={method === 'rulefit'} onClick={() => setMethod('rulefit')}>
            RuleFit (2008)
          </button>
          <button type="button" aria-pressed={method === 'sirus'} onClick={() => setMethod('sirus')}>
            SIRUS (2021)
          </button>
        </span>
        {method === 'rulefit' ? (
          <label className={figureStyles.inputLabel}>
            Lasso penalty: strong
            <input type="range" min={1} max={a.path.length - 1} value={step} onChange={(e) => setStep(Number(e.target.value))} aria-label="Lasso penalty (left: strong, few rules)" />
            weak
          </label>
        ) : (
          <label className={figureStyles.inputLabel}>
            Keep rules found in at least
            <select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className={styles.select}>
              {THRESHOLDS.map((t, i) => (
                <option key={t} value={i}>
                  {Math.round(t * 100)}% of trees
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className={figureStyles.withSide}>
        <div>
          <DecisionMap
            features={MAP_FEATURES}
            field={a.field}
            boxes={kept.map((r) => testsBox(r.tests, MAP_FEATURES, r.positive ? 1 : 0))}
            activeBox={active}
            disagree={disagreements(label, (x) => a.forest.label(x), MAP_FEATURES)}
            ariaLabel={`The forest's decision on the guard map, with the ${kept.length} kept rules drawn as boxes. ${caption}`}
          />
          <Legend
            items={[
              { key: 'modelYes', label: 'forest: spotted' },
              { key: 'modelNo', label: 'forest: hidden' },
              { key: 'rule', label: 'a kept rule (dashed: points to hidden)' },
              { key: 'disagree', label: 'rules and forest disagree' },
            ]}
          />
        </div>
        <div className={figureStyles.side}>
          <Scorecard score={{ fidelity, accuracy, rules: kept.length, conditions }} />
          <p className={styles.stability}>
            <b>Stability:</b> {pct(stability)} of these rules come back when the same method runs on a fresh batch of logs.
          </p>
          <ol className={styles.rules} tabIndex={0} aria-label="Kept rules">
            {kept.map((r, i) => (
              <li key={i} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} className={active === i ? styles.active : undefined}>
                <Conditions rule={{ tests: r.tests, prediction: 1 }} features={GUARD_FEATURES} />
                <span className={r.positive ? styles.towardsYes : styles.towardsNo}>{r.note}</span>
              </li>
            ))}
          </ol>
          <p className={figureStyles.note}>The forest itself matches the game on {pct(forestAccuracy)} of the map.</p>
        </div>
      </div>
      <Caption>{caption}</Caption>
    </>
  );
}

function keptRules(ranked: readonly SirusRule[], threshold: number): SirusRule[] {
  return ranked.filter((r) => r.frequency >= threshold);
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
