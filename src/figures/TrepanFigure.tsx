import { useMemo, useState, type ReactNode } from 'react';
import { GUARD_CLASSES, GUARD_FEATURES } from '../core/data/guard';
import { treeAfter, trepan, type TrepanEvent } from '../core/extract/trepan';
import { ruleSize, formatTest } from '../core/rules/rule';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure, Legend } from '../viz/Figure';
import { DecisionMap } from '../viz/map/DecisionMap';
import { disagreements, leafBoxes } from '../viz/map/field';
import { PlayerControls } from '../viz/PlayerControls';
import { RuleView } from '../viz/RuleView';
import { Scorecard } from '../viz/Scorecard';
import { handlePlaybackKeys, usePlayback, type Recording } from '../viz/usePlayback';
import { guardWorld, MAP_FEATURES, scoreOnMap } from './guardWorld';
import figureStyles from './figures.module.css';
import styles from './TrepanFigure.module.css';

const SIZES = [3, 7, 15];

interface Step {
  steps: number;
  event: TrepanEvent | null;
}

export function TrepanFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <Trepan number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function Trepan({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [queries, setQueries] = useState(true);
  const [limit, setLimit] = useState(15);
  const [activeRule, setActiveRule] = useState<number | null>(null);
  const world = useMemo(() => guardWorld(), []);

  const { tree, events, recording } = useMemo(() => {
    const events: TrepanEvent[] = [];
    const tree = trepan(GUARD_FEATURES, world.logs.X, world.box.label, { maxInternal: limit, sMin: 200, queries, seed: 1 }, (e) => events.push(e));
    const states: Step[] = [{ steps: 0, event: null }, ...events.map((event, i) => ({ steps: i + 1, event }))];
    const captions = [
      `One box covers the whole map, labelled with what the network says most often there. Step forward to split it.`,
      ...events.map(
        (e) =>
          `Split ${e.internal}: the box where the tree loses most agreement with the network (it covers ${Math.round(e.reach * 100)}% of cases and only ${Math.round(e.fidelity * 100)}% agree) is cut at “${formatTest(e.test, GUARD_FEATURES)}”.` +
          (queries ? ` To choose the cut, TREPAN asked the network about ${e.queries.length} made-up positions inside the box (rings), on top of ${e.examples} logged ones.` : ` It had only the ${e.examples} logged positions inside the box to go on.`),
      ),
    ];
    const recording: Recording<Step> = { states, captions };
    return { tree, events, recording };
  }, [world, limit, queries]);

  const playback = usePlayback(recording, 'slow');
  const { steps, event } = playback.state;
  const order = useMemo(() => events.map((e) => e.node), [events]);
  const current = useMemo(() => treeAfter(tree, order, steps), [tree, order, steps]);
  const label = (x: readonly number[]) => current.predict(x);
  const { fidelity, accuracy } = scoreOnMap(label, world);
  const yesRules = current.yesRules();
  const size = ruleSize(yesRules);
  const boxes = leafBoxes(current, MAP_FEATURES);
  const yesBoxIndex = boxes.flatMap((b, i) => (b.label === 1 ? [i] : []));
  const disagree = disagreements(label, world.box.label, MAP_FEATURES);

  return (
    <Figure number={number} title="Grow a tree that imitates the network (TREPAN)" tryThis={tryThis} onKeyDown={(e) => handlePlaybackKeys(e, playback)}>
      <div className={figureStyles.toolbar}>
        <label className={figureStyles.checkbox}>
          <input type="checkbox" checked={queries} onChange={(e) => setQueries(e.target.checked)} />
          Ask the network about made-up positions
        </label>
        <span className={figureStyles.segmented} role="group" aria-label="Size limit">
          {SIZES.map((s) => (
            <button key={s} type="button" aria-pressed={limit === s} onClick={() => setLimit(s)}>
              up to {s} splits
            </button>
          ))}
        </span>
      </div>

      <div className={figureStyles.withSide}>
        <div>
          <DecisionMap
            features={MAP_FEATURES}
            field={world.field}
            boxes={boxes}
            activeBox={activeRule === null ? null : yesBoxIndex[activeRule]}
            points={[
              ...world.logs.X.map((x) => ({ x, label: world.box.label(x), kind: 'example' as const })),
              ...(event && queries ? event.queries.map((x) => ({ x, label: world.box.label(x), kind: 'query' as const })) : []),
            ]}
            disagree={disagree}
            ariaLabel={`The guard map with the network's decision shaded and the tree's ${boxes.length} boxes drawn on top. ${playback.caption}`}
          />
          <Legend
            items={[
              { key: 'modelYes', label: 'network: spotted' },
              { key: 'modelNo', label: 'network: hidden' },
              { key: 'rule', label: 'tree box (dashed: hidden)' },
              { key: 'example', label: 'logged position' },
              ...(queries ? [{ key: 'query' as const, label: 'made-up question' }] : []),
              { key: 'disagree', label: 'tree and network disagree' },
            ]}
          />
        </div>
        <div className={figureStyles.side}>
          <Scorecard score={{ fidelity, accuracy, rules: size.rules, conditions: size.conditions }} />
          <div className={styles.rules} tabIndex={0} role="group" aria-label="Rules for spotted">
            <RuleView
              rules={yesRules}
              features={GUARD_FEATURES}
              classes={GUARD_CLASSES}
              kind="set"
              active={activeRule}
              onHoverRule={setActiveRule}
              empty="No box says “spotted” yet."
            />
          </div>
          <p className={figureStyles.note}>Accuracy here means agreeing with the game’s real logic. The network itself gets {Math.round(world.accuracy * 100)}% of the map right.</p>
        </div>
      </div>
      <PlayerControls playback={playback} />
      <Caption>{playback.caption}</Caption>
    </Figure>
  );
}
