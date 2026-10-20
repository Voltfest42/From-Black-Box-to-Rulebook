import { useMemo, useState, type ReactNode } from 'react';
import type { Instance } from '../core/data/dataset';
import { GUARD_CLASSES, GUARD_FEATURES } from '../core/data/guard';
import { lore, type LoreResult } from '../core/extract/lore';
import { formatConditions, formatNumber } from '../core/rules/rule';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure, Legend } from '../viz/Figure';
import { DecisionMap, type MapScale } from '../viz/map/DecisionMap';
import { leafBoxes } from '../viz/map/field';
import { guardWorld, MAP_FEATURES } from './guardWorld';
import figureStyles from './figures.module.css';
import styles from './LoreFigure.module.css';

const SHOWN = 2;

export function LoreFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <Lore number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function Lore({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const world = useMemo(() => guardWorld({ size: 240 }), []);
  const [x, setX] = useState<Instance>([7, 55]);
  const result = useMemo(() => lore(world.box.label, x, GUARD_FEATURES), [world, x]);
  const shown = result.counterfactuals.slice(0, SHOWN);
  const verdict = result.prediction === 1 ? GUARD_CLASSES.yes : GUARD_CLASSES.no;
  const other = result.prediction === 1 ? GUARD_CLASSES.no : GUARD_CLASSES.yes;

  const first = shown[0];
  const caption = first
    ? `Factual rule: ${verdict} because ${formatConditions(result.factual, GUARD_FEATURES)}. Smallest change: if ${changeText(first, x)}, you would have been ${other}${first.confirmed ? ' (checked with the network ✓)' : ' (the local tree says so, but the network disagrees there)'}.`
    : `Factual rule: ${verdict} because ${formatConditions(result.factual, GUARD_FEATURES)}. The local tree found no way to change the decision nearby.`;

  return (
    <Figure number={number} title="What would change the decision? Counterfactual rules (LORE)" tryThis={tryThis}>
      <div className={figureStyles.withSide}>
        <div>
          <DecisionMap
            features={MAP_FEATURES}
            field={world.field}
            boxes={leafBoxes(result.tree, MAP_FEATURES)}
            points={result.neighbourhood.map((n) => ({ x: n.x, label: n.label, kind: 'query' as const }))}
            onPick={setX}
            ariaLabel={`The guard map. Click to choose a position to explain. ${caption}`}
          >
            {(scale) => <Arrows scale={scale} x={x} result={result} />}
          </DecisionMap>
          <Legend
            items={[
              { key: 'modelYes', label: 'network: spotted' },
              { key: 'modelNo', label: 'network: hidden' },
              { key: 'query', label: 'generated neighbour' },
              { key: 'rule', label: 'local tree box' },
              { key: 'counterfactual', label: 'smallest change that flips the decision' },
            ]}
          />
        </div>
        <div className={figureStyles.side}>
          <div className={styles.panel}>
            <p className={styles.label}>Why</p>
            <p>
              <b className={result.prediction === 1 ? styles.yes : styles.no}>{verdict}</b> because <b>{formatConditions(result.factual, GUARD_FEATURES)}</b>
            </p>
          </div>
          <div className={styles.panel}>
            <p className={styles.label}>What would change it</p>
            {shown.length === 0 ? (
              <p>Nothing nearby, according to the local tree.</p>
            ) : (
              <ol className={styles.counterfactuals}>
                {shown.map((c, i) => (
                  <li key={i}>
                    If <b>{changeText(c, x)}</b>, you’d have been <b className={result.prediction === 1 ? styles.no : styles.yes}>{other}</b>.{' '}
                    <span className={c.confirmed ? styles.ok : styles.bad}>{c.confirmed ? '✓ checked with the network' : '✗ the network disagrees'}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <p className={figureStyles.note}>
            The local tree agrees with the network on {Math.round(result.localFidelity * 100)}% of the {result.neighbourhood.length} generated neighbours. Click the map to explain another position.
          </p>
        </div>
      </div>
      <Caption>{caption}</Caption>
    </Figure>
  );
}

function changeText(c: LoreResult['counterfactuals'][number], x: Instance): string {
  return c.changes
    .map((t) => {
      if (t.kind !== 'num') return formatConditions([t], GUARD_FEATURES);
      const f = GUARD_FEATURES[t.feature];
      return `the ${f.name} were ${t.above ? 'at least' : 'below'} ${formatNumber(t.threshold, f)} (it was ${formatNumber(x[t.feature], f)})`;
    })
    .join(' and ');
}

function Arrows({ scale, x, result }: { scale: MapScale; x: Instance; result: LoreResult }) {
  return (
    <g>
      <defs>
        <marker id="lore-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className={styles.head} />
        </marker>
      </defs>
      {result.counterfactuals.slice(0, SHOWN).map((c, i) => (
        <g key={i}>
          <line x1={scale.sx(x[0])} y1={scale.sy(x[1])} x2={scale.sx(c.point[0])} y2={scale.sy(c.point[1])} className={c.confirmed ? styles.arrow : styles.arrowBad} markerEnd="url(#lore-arrow)" />
          <circle cx={scale.sx(c.point[0])} cy={scale.sy(c.point[1])} r={4} className={styles.target} />
        </g>
      ))}
      <circle cx={scale.sx(x[0])} cy={scale.sy(x[1])} r={6} className={styles.case} />
    </g>
  );
}
