import { useEffect, useMemo, useState } from 'react';
import type { Instance, NumericFeature } from '../core/data/dataset';
import { ALL_ROBOTS, describeRobot, type MonkProblem } from '../core/data/robots';
import { toyDataset } from '../core/data/toy2d';
import { labelAll } from '../core/rules/metrics';
import type { Rule, Test } from '../core/rules/rule';
import { formatConditions } from '../core/rules/rule';
import { Legend } from '../viz/Figure';
import { DecisionMap, type MapScale } from '../viz/map/DecisionMap';
import { computeField, disagreements, leafBoxes, testsBox, type Box } from '../viz/map/field';
import { GRID_KEY } from '../viz/robots/layout';
import { RobotGrid } from '../viz/robots/RobotGrid';
import { Conditions, RuleView } from '../viz/RuleView';
import { Scorecard } from '../viz/Scorecard';
import { TreeOutline } from '../viz/TreeOutline';
import pageStyles from '../site/pages/pages.module.css';
import figureStyles from '../figures/figures.module.css';
import {
  canTrain,
  DATA_LABELS,
  extract,
  isLocal,
  isRobots,
  makeWorld,
  METHOD_LABELS,
  methodsFor,
  MODEL_LABELS,
  score,
  trainModel,
  type DataChoice,
  type DrawnPoint,
  type Extraction,
  type Model,
  type MethodChoice,
  type ModelChoice,
  type World,
} from './engine';
import { useCorels } from './useCorels';
import { useDeferred } from './useDeferred';
import styles from './Lab.module.css';

const DATA: DataChoice[] = ['guard', 'moons', 'spiral', 'xor', 'rings', 'draw', 'monk1', 'monk3', 'monk2'];
type Brush = 'orange' | 'blue' | 'erase' | 'case';
const STORAGE_KEY = 'rulebook-lab-drawing';
const MAX_POINTS = 500;

/** A small two-moons sketch to start drawing from. */
function exampleDrawing(): DrawnPoint[] {
  const d = toyDataset('moons', 40, 5);
  return d.X.map((x, i) => ({ x, y: d.y[i] }));
}

/** Changes whenever the drawing does, so the black box is retrained. */
function drawingKey(drawn: readonly DrawnPoint[]): string {
  let h = 0;
  drawn.forEach((p, i) => {
    h = (h * 31 + Math.round(p.x[0] * 1000) * 7 + Math.round(p.x[1] * 1000) * 13 + p.y + i) | 0;
  });
  return `${drawn.length}-${h}`;
}

/** The reader's last drawing, kept in this browser only. */
function loadDrawing(): DrawnPoint[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as DrawnPoint[] | null;
    if (Array.isArray(saved) && saved.every((p) => Array.isArray(p.x) && p.x.length === 2 && (p.y === 0 || p.y === 1))) return saved.slice(0, MAX_POINTS);
  } catch {
    // No storage (private window, blocked): start from the example.
  }
  return exampleDrawing();
}
const MODELS: ModelChoice[] = ['network', 'forest', 'knn'];
/** CORELS's penalty per rule, as in Chapter 5. */
const CORELS_LAMBDA = 0.025;

export function Lab() {
  const [data, setData] = useState<DataChoice>('guard');
  const [modelChoice, setModelChoice] = useState<ModelChoice>('network');
  const [method, setMethod] = useState<MethodChoice>('trepan');
  const [size, setSize] = useState(8);
  const [seed, setSeed] = useState(1);
  const [point, setPoint] = useState<Instance | null>(null);
  const [robot, setRobot] = useState(5);
  const [drawn, setDrawn] = useState<DrawnPoint[]>(loadDrawing);
  const [brush, setBrush] = useState<Brush>('orange');
  const drawing = data === 'draw';

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drawn));
    } catch {
      // Not saved; the drawing still works for this visit.
    }
  }, [drawn]);

  const world = useMemo(() => makeWorld(data, seed, drawn), [data, seed, drawn]);
  const trainable = canTrain(world);
  const available = methodsFor(data);
  const chosen = available.includes(method) ? method : 'trepan';
  const robots = isRobots(data);
  const features = world.features as readonly NumericFeature[];
  const defaultPoint: Instance = robots ? ALL_ROBOTS[robot] : [(features[0].min + features[0].max) / 2, (features[1].min + features[1].max) / 2];
  const target = robots ? ALL_ROBOTS[robot] : (point ?? defaultPoint);

  // While the reader draws, wait for a pause before training again.
  const modelKey = `${data}-${seed}-${modelChoice}${drawing ? `-${drawingKey(drawn)}` : ''}`;
  const delay = drawing ? 300 : 20;
  const model = useDeferred(() => (trainable ? trainModel(world, modelChoice, seed) : null), modelKey, delay);
  const modelReady = model.value !== null && !model.pending;
  const inWorker = chosen === 'corels';
  const extractionKey = `${modelKey}-${chosen}-${size}-${target.join(',')}`;
  const extraction = useDeferred(
    () => (modelReady && !inWorker ? { key: modelKey, data, model: model.value!, method: chosen, result: extract(world, model.value!, chosen, size, target, seed) } : null),
    modelReady && !inWorker ? extractionKey : `${extractionKey}-waiting`,
  );
  const corelsRun = useCorels(
    modelReady && inWorker && isRobots(data)
      ? { key: modelKey, request: () => ({ problem: Number(data.slice(4)) as MonkProblem, seed, lambda: CORELS_LAMBDA, labels: labelAll(model.value!.label, world.train.X), maxNodes: 4_000_000 }) }
      : null,
  );
  const shown = inWorker
    ? corelsRun?.extraction
      ? { model: model.value!, method: chosen, result: corelsRun.extraction }
      : null
    : // A drawing keeps showing its last result while the next one trains.
      extraction.value && (extraction.value.key === modelKey || (drawing && extraction.value.data === 'draw' && trainable))
      ? extraction.value
      : null;
  const ready = modelReady && shown !== null && (inWorker || !extraction.pending);

  const brushes: Brush[] = isLocal(chosen) ? ['orange', 'blue', 'erase', 'case'] : ['orange', 'blue', 'erase'];
  const activeBrush = brushes.includes(brush) ? brush : 'orange';
  const changeDrawing = (next: DrawnPoint[]) => setDrawn(next);
  // Updates build on the latest drawing, since a fast drag sends several points between renders.
  const paint = (x: Instance) => {
    if (activeBrush === 'case') return setPoint(x);
    if (activeBrush === 'erase') {
      setDrawn((prev) => {
        const kept = prev.filter((p) => Math.hypot(p.x[0] - x[0], p.x[1] - x[1]) > 0.12);
        return kept.length < prev.length ? kept : prev;
      });
      return;
    }
    // Space the points out a little, so a drag draws a line of them rather than a pile.
    setDrawn((prev) =>
      prev.length >= MAX_POINTS || prev.some((p) => Math.hypot(p.x[0] - x[0], p.x[1] - x[1]) < 0.06) ? prev : [...prev, { x, y: activeBrush === 'orange' ? 1 : 0 }],
    );
  };

  const chooseData = (d: DataChoice) => {
    setData(d);
    setPoint(null);
    if (!methodsFor(d).includes(method)) setMethod('trepan');
  };

  return (
    <article className={`${pageStyles.page} ${styles.page}`}>
      <header className={pageStyles.chapterHeader}>
        <p className={pageStyles.kicker}>The Lab</p>
        <h1>Try any method on any model</h1>
        <p className={pageStyles.lede}>Pick some data, train a black box on it, and extract rules from it. Everything runs in your browser.</p>
      </header>

      <section className={styles.controls} aria-label="Settings">
        <div className={styles.step}>
          <span className={styles.stepNumber}>1</span>
          <label className={styles.field}>
            Data
            <select aria-label="Data" value={data} onChange={(e) => chooseData(e.target.value as DataChoice)} className={styles.select}>
              {DATA.map((d) => (
                <option key={d} value={d}>
                  {DATA_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
          {!drawing && (
            <button type="button" className={figureStyles.toolButton} onClick={() => setSeed((s) => s + 1)}>
              New sample
            </button>
          )}
        </div>
        {drawing && (
          <div className={styles.step}>
            <span className={styles.fieldLabel}>Click or drag on the map to</span>
            <span className={figureStyles.segmented} role="group" aria-label="Drawing tool">
              {brushes.map((b) => (
                <button key={b} type="button" aria-pressed={activeBrush === b} onClick={() => setBrush(b)}>
                  {b === 'orange' ? 'Add orange' : b === 'blue' ? 'Add blue' : b === 'erase' ? 'Erase' : 'Choose the case'}
                </button>
              ))}
            </span>
            <button type="button" className={figureStyles.toolButton} onClick={() => changeDrawing([])}>
              Clear
            </button>
            <button type="button" className={figureStyles.toolButton} onClick={() => changeDrawing(exampleDrawing())}>
              Example
            </button>
            <span className={figureStyles.note}>{drawn.length} points</span>
          </div>
        )}
        <div className={styles.step}>
          <span className={styles.stepNumber}>2</span>
          <span className={styles.fieldLabel}>Black box</span>
          <span className={figureStyles.segmented} role="group" aria-label="Black box">
            {MODELS.map((m) => (
              <button key={m} type="button" aria-pressed={modelChoice === m} onClick={() => setModelChoice(m)}>
                {MODEL_LABELS[m]}
              </button>
            ))}
          </span>
        </div>
        <div className={styles.step}>
          <span className={styles.stepNumber}>3</span>
          <label className={styles.field}>
            Extraction
            <select aria-label="Extraction method" value={chosen} onChange={(e) => setMethod(e.target.value as MethodChoice)} className={styles.select}>
              {available.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          {!isLocal(chosen) && !inWorker && (
            <label className={styles.field}>
              Rule budget
              <input type="range" min={2} max={20} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Most leaves or rules allowed" />
              <output className={styles.size}>{size}</output>
            </label>
          )}
        </div>
      </section>

      <div className={styles.result} aria-busy={!ready}>
        {!ready && (
          <p className={styles.working}>
            {inWorker && corelsRun ? (corelsRun.error ? `The search failed: ${corelsRun.error}` : `Searching… ${corelsRun.nodes.toLocaleString('en')} prefixes so far`) : 'Working…'}
          </p>
        )}
        {inWorker && !shown && <p className={figureStyles.note}>CORELS searches every short rule list for the best one, and proves no list scores better. This can take several seconds.</p>}
        {shown && (!drawing || trainable) ? (
          <Result
            world={world}
            model={shown.model}
            extraction={shown.result}
            method={shown.method}
            target={target}
            robotIndex={robot}
            onPickPoint={drawing ? paint : (x) => setPoint(x)}
            painting={drawing && activeBrush !== 'case'}
            onPickRobot={setRobot}
          />
        ) : (
          drawing && <Board world={world} onPaint={paint} enough={trainable} />
        )}
      </div>

      <section className={styles.ideas} aria-labelledby="lab-ideas">
        <h2 id="lab-ideas">Things to try</h2>
        <ul>
          <li>
            <b>Spirals:</b> set the rule budget to 4, then 20. How many boxes does it take to copy a curved boundary?
          </li>
          <li>
            <b>Checkerboard:</b> set the budget to 4, then 6. Four squares should need only four leaves, so why does a tree grown one split at a time need more?
          </li>
          <li>
            <b>Robots, Puzzle 1:</b> run CORELS on each black box. Does it recover the hidden rule every time?
          </li>
          <li>
            <b>Robots, Puzzle 3:</b> the hidden rule counts traits, so short rules struggle. Compare TREPAN's m-of-n rules with the surrogate tree on the neural network.
          </li>
          <li>
            <b>Draw your own:</b> clear the map and draw a slanted line, orange on one side and blue on the other. How many boxes does a tree need to copy one straight edge
            that isn’t level?
          </li>
          <li>
            <b>The guard, with LORE:</b> click cases near the edge and far from it. Which counterfactuals are the shortest?
          </li>
        </ul>
      </section>
    </article>
  );
}

interface ResultProps {
  world: World;
  model: Model;
  extraction: Extraction;
  method: MethodChoice;
  target: Instance;
  robotIndex: number;
  onPickPoint: (x: Instance) => void;
  /** The map paints points (a drawing) instead of choosing a case. */
  painting?: boolean;
  onPickRobot: (i: number) => void;
}

/** The drawing before there is enough of it to train on. */
function Board({ world, onPaint, enough }: { world: World; onPaint: (x: Instance) => void; enough: boolean }) {
  const features = world.features as readonly NumericFeature[];
  return (
    <div>
      <DecisionMap
        features={[features[0], features[1]]}
        points={world.train.X.map((x, i) => ({ x, label: world.train.y[i], kind: 'example' as const }))}
        onPick={onPaint}
        paint
        ariaLabel={`Your drawing: ${world.train.X.length} points.`}
      />
      <p className={figureStyles.note}>{enough ? 'Training…' : 'Add at least two points of each colour, and a black box will be trained on them.'}</p>
    </div>
  );
}

function Result({ world, model, extraction, method, target, robotIndex, onPickPoint, painting = false, onPickRobot }: ResultProps) {
  const robots = isRobots(world.data);
  const features = world.features as readonly NumericFeature[];
  const mapFeatures = robots ? null : ([features[0], features[1]] as const);
  const field = useMemo(() => (mapFeatures ? computeField(model.proba, mapFeatures, 80, 60) : null), [model, mapFeatures?.[0], mapFeatures?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  // What the rules say, for scoring and drawing.
  const label = 'label' in extraction ? extraction.label : null;
  const scores = label ? score(world, model, label) : null;
  let rules: Rule[] = [];
  let boxes: Box[] = [];
  if (extraction.kind === 'tree') {
    rules = extraction.rules;
    if (mapFeatures) boxes = leafBoxes(extraction.tree, mapFeatures);
  } else if (extraction.kind === 'rulefit') {
    rules = extraction.rules.map((r) => ({ tests: r.tests, prediction: r.weight > 0 ? 1 : 0 }));
    if (mapFeatures) boxes = extraction.rules.map((r) => testsBox(r.tests, mapFeatures, r.weight > 0 ? 1 : 0));
  } else if (extraction.kind === 'list') {
    rules = [...extraction.list.rules];
  } else if (extraction.kind === 'lore') {
    rules = [{ tests: extraction.result.factual, prediction: extraction.result.prediction }];
    if (mapFeatures) boxes = [testsBox(extraction.result.factual, mapFeatures, extraction.result.prediction)];
  }
  const conditions = rules.reduce((s, r) => s + r.tests.length, 0);

  const anchorTests: Test[] = extraction.kind === 'anchors' && extraction.anchor ? extraction.anchor.features.map((f) => ({ kind: 'cat', feature: f, value: target[f], equal: true })) : [];
  const anchorCovered = extraction.kind === 'anchors' && extraction.anchor ? ALL_ROBOTS.map((z) => extraction.anchor!.features.every((f) => z[f] === target[f])) : null;
  const coveredByRules = robots && (extraction.kind === 'tree' || extraction.kind === 'rulefit' || extraction.kind === 'list') && label ? ALL_ROBOTS.map((x) => label(x) === 1) : null;

  return (
    <div className={figureStyles.withSide}>
      <div>
        {mapFeatures ? (
          <>
            <DecisionMap
              features={mapFeatures}
              field={field}
              boxes={boxes}
              points={[
                ...world.train.X.map((x, i) => ({ x, label: world.train.y[i], kind: 'example' as const })),
                ...(extraction.kind === 'lore' ? extraction.result.neighbourhood.slice(0, 200).map((n) => ({ x: n.x, label: n.label, kind: 'query' as const })) : []),
              ]}
              disagree={label ? disagreements(label, model.label, mapFeatures) : []}
              onPick={painting || isLocal(method) ? onPickPoint : undefined}
              paint={painting}
              ariaLabel={`The black box's decision on the map${label ? ', with the extracted rules and where they disagree' : ''}.`}
            >
              {(scale) => (isLocal(method) ? <Local scale={scale} target={target} extraction={extraction} features={mapFeatures} /> : null)}
            </DecisionMap>
            <Legend
              items={[
                { key: 'modelYes', label: `black box: ${world.classes.yes}` },
                { key: 'modelNo', label: `black box: ${world.classes.no}` },
                { key: 'example', label: world.data === 'draw' ? 'a point you drew' : 'training example (its label)' },
                ...(label ? [{ key: 'disagree' as const, label: 'rules and black box disagree' }] : []),
              ]}
            />
            {isLocal(method) && !painting && (
              <p className={figureStyles.note}>{world.data === 'draw' ? 'Click the map to choose the case to explain, or pick a drawing tool to keep drawing.' : 'Click the map to choose the case to explain.'}</p>
            )}
          </>
        ) : (
          <>
            <RobotGrid
              tint={model.probeLabels}
              highlight={anchorCovered ?? coveredByRules}
              wrong={label ? ALL_ROBOTS.map((x, i) => label(x) !== model.probeLabels[i]) : undefined}
              selected={method === 'anchors' ? robotIndex : null}
              onPick={method === 'anchors' ? onPickRobot : undefined}
              ariaLabel="All 432 robots, coloured by the black box's answer."
            />
            <Legend
              items={[
                { key: 'yes', label: 'black box: friendly' },
                { key: 'no', label: 'black box: not friendly' },
                { key: 'rule', label: method === 'anchors' ? 'covered by the anchor' : 'the rules say friendly' },
                ...(label ? [{ key: 'disagree' as const, label: 'rules and black box disagree' }] : []),
              ]}
            />
            <p className={figureStyles.note}>
              {method === 'anchors' ? `Explaining: ${describeRobot(target)}. Click another robot to explain it. ` : ''}
              {GRID_KEY}
            </p>
          </>
        )}
      </div>

      <div className={figureStyles.side}>
        <p className={styles.modelLine}>
          {model.accuracy === null ? (
            <>The black box is trained on the {world.train.X.length} points you drew. With no true rule behind them, there is no accuracy to measure, only fidelity.</>
          ) : (
            <>
              The black box gets <b>{Math.round(model.accuracy * 100)}%</b> of fresh cases right.
            </>
          )}
        </p>
        {scores && <Scorecard score={{ fidelity: scores.fidelity, accuracy: scores.accuracy, rules: rules.length, conditions }} />}
        {extraction.kind === 'tree' && (
          <details className={styles.treeDetails}>
            <summary>Show the tree</summary>
            <TreeOutline root={extraction.tree.root} features={world.features} classes={world.classes} />
          </details>
        )}
        {extraction.kind === 'tree' && (
          <div className={styles.rules} tabIndex={0} role="group" aria-label="Extracted rules">
            <RuleView rules={rules.filter((r) => r.prediction === 1)} features={world.features} classes={world.classes} kind="set" empty={`No rule says “${world.classes.yes}”.`} />
          </div>
        )}
        {extraction.kind === 'list' && (
          <>
            <div className={styles.rules} tabIndex={0} role="group" aria-label="Extracted rules">
              <RuleView rules={extraction.list.rules} features={world.features} classes={world.classes} kind="list" fallback={extraction.list.fallback} />
            </div>
            {extraction.list.rules.length === 0 && (
              <p className={figureStyles.note}>No short rule list copies the black box well enough to be worth its penalty, so the best list has no rules at all.</p>
            )}
            <p className={figureStyles.note}>
              {extraction.certified
                ? `Certified: no rule list does better at copying the black box on the training robots, counting a penalty of ${CORELS_LAMBDA * 100}% per rule.`
                : 'The search hit its safety limit before finishing its proof, so this is the best list found, not certified.'}
            </p>
          </>
        )}
        {extraction.kind === 'rulefit' && (
          <>
            <p className={figureStyles.note}>Each rule that applies adds its weight to the score; a positive total means “{world.classes.yes}”.</p>
            <ol className={styles.weighted} tabIndex={0} aria-label="Weighted rules">
              {[...extraction.rules]
                .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
                .map((r, i) => (
                  <li key={i}>
                    <Conditions rule={{ tests: r.tests, prediction: 1 }} features={world.features} />
                    <span className={r.weight > 0 ? styles.towardsYes : styles.towardsNo}>
                      {r.weight > 0 ? '+' : '−'}
                      {Math.abs(r.weight) >= 0.01 ? Math.abs(r.weight).toFixed(2) : Math.abs(r.weight).toPrecision(1)}
                    </span>
                  </li>
                ))}
              {extraction.rules.length === 0 && <li>No rules kept.</li>}
            </ol>
          </>
        )}
        {extraction.kind === 'lime' && (
          <div className={styles.panel}>
            <p>
              Near this point, the chance of “{world.classes.yes}” changes by{' '}
              {extraction.result.weights.map((w, i) => `${w >= 0 ? '+' : '−'}${Math.abs(w * (features[i].max - features[i].min) * 100).toFixed(0)} points across the range of ${features[i].name}`).join(', and ')}.
            </p>
            <p className={figureStyles.note}>The line agrees with the black box on {scores ? Math.round(scores.fidelity * 100) : 0}% of the whole map.</p>
          </div>
        )}
        {extraction.kind === 'lore' && (
          <div className={styles.panel}>
            <p>
              <b>{extraction.result.prediction === 1 ? world.classes.yes : world.classes.no}</b> because {formatConditions(extraction.result.factual, world.features)}.
            </p>
            {extraction.result.counterfactuals.slice(0, 2).map((c, i) => (
              <p key={i}>
                Would change if {formatConditions(c.changes, world.features)} {c.confirmed ? '✓' : '(not confirmed by the black box)'}
              </p>
            ))}
          </div>
        )}
        {extraction.kind === 'anchors' && (
          <div className={styles.panel}>
            {extraction.anchor ? (
              <>
                <RuleView rules={[{ tests: anchorTests, prediction: extraction.target }]} features={world.features} classes={world.classes} kind="set" alone />
                <p className={figureStyles.note}>
                  Precision about {Math.round(extraction.anchor.mean * 100)}%, covering {Math.round(extraction.anchor.coverage * 100)}% of robots.
                </p>
              </>
            ) : (
              <p>No anchor found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Local({ scale, target, extraction, features }: { scale: MapScale; target: Instance; extraction: Extraction; features: readonly [NumericFeature, NumericFeature] }) {
  let line: string | null = null;
  if (extraction.kind === 'lime') {
    const [w0, w1] = extraction.result.weights;
    const pts: string[] = [];
    for (let k = 0; k <= 60 && Math.abs(w1) > 1e-9; k++) {
      const d = features[0].min + (k / 60) * (features[0].max - features[0].min);
      const l = (0.5 - extraction.result.intercept - w0 * d) / w1;
      if (l >= features[1].min && l <= features[1].max) pts.push(`${scale.sx(d)},${scale.sy(l)}`);
    }
    if (pts.length > 1) line = pts.join(' ');
  }
  return (
    <g>
      {line && <polyline points={line} className={styles.limeLine} />}
      {extraction.kind === 'lore' &&
        extraction.result.counterfactuals.slice(0, 2).map((c, i) => <line key={i} x1={scale.sx(target[0])} y1={scale.sy(target[1])} x2={scale.sx(c.point[0])} y2={scale.sy(c.point[1])} className={styles.arrow} />)}
      <circle cx={scale.sx(target[0])} cy={scale.sy(target[1])} r={6} className={styles.case} />
    </g>
  );
}
