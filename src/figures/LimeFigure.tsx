import { useMemo, useState, type ReactNode } from 'react';
import type { Instance } from '../core/data/dataset';
import { GUARD_CLASSES, GUARD_FEATURES } from '../core/data/guard';
import { lime, limePredict } from '../core/extract/lime';
import { agreement, labelAll } from '../core/rules/metrics';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure, Legend } from '../viz/Figure';
import { DecisionMap, type MapScale } from '../viz/map/DecisionMap';
import { disagreements } from '../viz/map/field';
import { GRID, guardWorld, MAP_FEATURES } from './guardWorld';
import figureStyles from './figures.module.css';
import styles from './LimeFigure.module.css';

const KERNEL = 0.15;

export function LimeFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <Lime number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function Lime({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const world = useMemo(() => guardWorld({ size: 240 }), []);
  const [x, setX] = useState<Instance>([2, 30]);
  const result = useMemo(() => lime(world.box.proba, x, GUARD_FEATURES, { kernelWidth: KERNEL, spread: 0.15 }), [world, x]);
  const lineLabel = (z: Instance) => (limePredict(result, z) >= 0.5 ? 1 : 0);

  // Agreement near the case (inside the kernel's reach) and over the whole map.
  const near = GRID.filter((z) => Math.hypot((z[0] - x[0]) / 20, (z[1] - x[1]) / 100) <= KERNEL);
  const nearAgreement = agreement(labelAll(lineLabel, near), labelAll(world.box.label, near));
  const mapAgreement = agreement(labelAll(lineLabel, GRID), world.gridLabels);
  const verdict = world.box.label(x) === 1 ? GUARD_CLASSES.yes : GUARD_CLASSES.no;
  const [wDistance, wLight] = result.weights;

  const caption = `At ${x[0].toFixed(1)} m and ${Math.round(x[1])}% light the network says “${verdict}”. LIME's explanation: each extra metre of distance changes the chance of being spotted by ${signed(wDistance * 100)} points, each extra % of light by ${signed(wLight * 100)}. Inside the circle the line agrees with the network on ${pct(nearAgreement)} of positions; over the whole map, on only ${pct(mapAgreement)}.`;

  return (
    <Figure number={number} title="A straight line is not a rule: LIME explains one decision" tryThis={tryThis}>
      <div className={figureStyles.withSide}>
        <div>
          <DecisionMap
            features={MAP_FEATURES}
            field={world.field}
            disagree={disagreements(lineLabel, world.box.label, MAP_FEATURES)}
            onPick={setX}
            ariaLabel={`The guard map. Click to choose a position to explain. ${caption}`}
          >
            {(scale) => <Overlay scale={scale} x={x} result={result} />}
          </DecisionMap>
          <Legend
            items={[
              { key: 'modelYes', label: 'network: spotted' },
              { key: 'modelNo', label: 'network: hidden' },
              { key: 'query', label: 'sample LIME asked about (bolder = counts more)' },
              { key: 'disagree', label: "line and network disagree" },
            ]}
          />
        </div>
        <div className={figureStyles.side}>
          <div className={styles.panel}>
            <p className={styles.title}>Why “{verdict}” here, according to LIME</p>
            <Bar label="distance" value={wDistance * 20} hint={`${signed(wDistance * 100)} points per metre`} />
            <Bar label="light" value={wLight * 100} hint={`${signed(wLight * 100)} points per %`} />
            <p className={figureStyles.note}>Bars: how much the chance of being spotted changes across each feature’s whole range, if the line held everywhere. The line fits the network near here with R² = {result.r2.toFixed(2)}.</p>
          </div>
          <dl className={styles.stats}>
            <div>
              <dt>Agrees with the network inside the circle</dt>
              <dd>{pct(nearAgreement)}</dd>
            </div>
            <div>
              <dt>…and over the whole map</dt>
              <dd>{pct(mapAgreement)}</dd>
            </div>
          </dl>
          <p className={figureStyles.note}>Click anywhere on the map to explain another position.</p>
        </div>
      </div>
      <Caption>{caption}</Caption>
    </Figure>
  );
}

function Overlay({ scale, x, result }: { scale: MapScale; x: Instance; result: ReturnType<typeof lime> }) {
  const [fx, fy] = MAP_FEATURES;
  // The line where LIME's model crosses 50%, traced across the map.
  const points: string[] = [];
  const [w0, w1] = result.weights;
  for (let k = 0; k <= 60; k++) {
    const d = fx.min + (k / 60) * (fx.max - fx.min);
    if (Math.abs(w1) < 1e-9) continue;
    const l = (0.5 - result.intercept - w0 * d) / w1;
    if (l >= fy.min && l <= fy.max) points.push(`${scale.sx(d)},${scale.sy(l)}`);
  }
  const rx = scale.sx(x[0] + KERNEL * (fx.max - fx.min)) - scale.sx(x[0]);
  const ry = scale.sy(x[1]) - scale.sy(x[1] + KERNEL * (fy.max - fy.min));
  return (
    <g>
      {result.samples.map((s, i) => (
        <circle key={i} cx={scale.sx(s.x[0])} cy={scale.sy(s.x[1])} r={2} className={styles.sample} style={{ opacity: 0.1 + 0.8 * s.weight }} />
      ))}
      <ellipse cx={scale.sx(x[0])} cy={scale.sy(x[1])} rx={rx} ry={ry} className={styles.reach} />
      {points.length > 1 && <polyline points={points.join(' ')} className={styles.line} />}
      <circle cx={scale.sx(x[0])} cy={scale.sy(x[1])} r={6} className={styles.case} />
    </g>
  );
}

function Bar({ label, value, hint }: { label: string; value: number; hint: string }) {
  const width = Math.min(100, Math.abs(value) * 100);
  return (
    <div className={styles.bar}>
      <span className={styles.barLabel}>{label}</span>
      <span className={styles.track} aria-hidden="true">
        <span className={value >= 0 ? styles.up : styles.down} style={{ width: `${width / 2}%`, [value >= 0 ? 'left' : 'right']: '50%' }} />
      </span>
      <span className={styles.barHint}>{hint}</span>
    </div>
  );
}

function signed(points: number): string {
  const rounded = Math.abs(points) < 0.05 ? 0 : points;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded).toFixed(1)}`;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
