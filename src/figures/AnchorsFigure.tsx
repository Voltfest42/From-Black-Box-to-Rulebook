import { useMemo, useState, type ReactNode } from 'react';
import { ALL_ROBOTS, describeRobot, monkTrainingSet, ROBOT_CLASSES, ROBOT_FEATURES, type MonkProblem } from '../core/data/robots';
import { anchors, type AnchorEvent, type Candidate } from '../core/extract/anchors';
import { trainNetwork } from '../core/models/blackbox';
import { labelAll } from '../core/rules/metrics';
import type { Rule, Test } from '../core/rules/rule';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure, Legend } from '../viz/Figure';
import { PlayerControls } from '../viz/PlayerControls';
import { GRID_KEY } from '../viz/robots/layout';
import { RobotGrid } from '../viz/robots/RobotGrid';
import { RobotPortrait } from '../viz/robots/RobotPortrait';
import { RuleView } from '../viz/RuleView';
import { handlePlaybackKeys, usePlayback, type Recording } from '../viz/usePlayback';
import figureStyles from './figures.module.css';
import styles from './AnchorsFigure.module.css';

const PUZZLES: { problem: MonkProblem; label: string }[] = [
  { problem: 1, label: 'Puzzle 1' },
  { problem: 2, label: 'Puzzle 3 (hard)' },
];
const SHOWN = 8;

const networks = new Map<MonkProblem, (x: readonly number[]) => number>();
function networkFor(problem: MonkProblem) {
  let label = networks.get(problem);
  if (!label) {
    label = trainNetwork(monkTrainingSet(problem, 1), { hidden: [6], epochs: 250, seed: problem === 2 ? 3 : 1 }).box.label;
    networks.set(problem, label);
  }
  return label;
}

const testsFor = (robot: readonly number[], features: readonly number[]): Test[] => features.map((f) => ({ kind: 'cat', feature: f, value: robot[f], equal: true }));

interface View {
  round: (AnchorEvent & { kind: 'round' }) | null;
  result: (AnchorEvent & { kind: 'result' }) | null;
}

export function AnchorsFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <Anchors number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function Anchors({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [problem, setProblem] = useState<MonkProblem>(1);
  const [robot, setRobot] = useState(5);
  const label = useMemo(() => networkFor(problem), [problem]);
  const labels = useMemo(() => labelAll(label, ALL_ROBOTS), [label]);
  const x = ALL_ROBOTS[robot];
  const verdict = labels[robot];

  const recording: Recording<View> = useMemo(() => {
    const events: AnchorEvent[] = [];
    anchors(label, x, ROBOT_FEATURES, { seed: robot + 1 }, (e) => events.push(e));
    const states: View[] = [{ round: null, result: null }];
    const captions = [`The network calls this robot ${verdict === 1 ? ROBOT_CLASSES.yes : ROBOT_CLASSES.no}. Which of its traits are enough to guarantee that? Press play.`];
    for (const e of events) {
      if (e.kind === 'round') {
        states.push({ round: e, result: null });
        const anchorsHere = e.anchors.length;
        captions.push(
          `Rules with ${e.length} condition${e.length === 1 ? '' : 's'}: ${e.candidates.length} candidates. Each is tested by asking the network about random robots that share those traits. ` +
            (anchorsHere > 0
              ? `${anchorsHere} reach 95% precision with confidence: an anchor!`
              : `None is reliably 95% precise yet, so the best ${e.beam.length} go on to get one more condition.`) +
            ` Network calls so far: ${e.samplesSoFar.toLocaleString('en')}.`,
        );
      } else {
        states.push({ round: (states[states.length - 1].round ?? null) as View['round'], result: e });
        captions.push(
          e.anchor
            ? `The anchor with the widest coverage wins. It took ${e.samplesSoFar.toLocaleString('en')} questions to the network.`
            : 'No anchor found.',
        );
      }
    }
    return { states, captions };
  }, [label, x, robot, verdict]);
  const playback = usePlayback(recording, 'slow');
  const { round, result } = playback.state;

  const anchor = result?.anchor ?? null;
  const shownRule: Candidate | null = anchor ?? (round ? round.candidates[round.beam[0]] : null);
  const covered = shownRule ? ALL_ROBOTS.map((z) => shownRule.features.every((f) => z[f] === x[f])) : null;
  const exactPrecision = covered ? covered.reduce((n, c, i) => n + (c && labels[i] === verdict ? 1 : 0), 0) / Math.max(1, covered.filter(Boolean).length) : null;
  const anchorRule: Rule | null = anchor ? { tests: testsFor(x, anchor.features), prediction: verdict } : null;

  const pick = (index: number) => setRobot(index);
  const pickRandom = (wanted: number) => {
    const options = labels.flatMap((l, i) => (l === wanted && i !== robot ? [i] : []));
    if (options.length) setRobot(options[(robot * 7919 + options.length) % options.length]);
  };

  return (
    <Figure number={number} title="Find the anchor: a short rule that pins one prediction" tryThis={tryThis} onKeyDown={(e) => handlePlaybackKeys(e, playback)}>
      <div className={figureStyles.toolbar}>
        <span className={figureStyles.segmented} role="group" aria-label="Puzzle">
          {PUZZLES.map((p) => (
            <button key={p.problem} type="button" aria-pressed={problem === p.problem} onClick={() => setProblem(p.problem)}>
              {p.label}
            </button>
          ))}
        </span>
        <button type="button" className={figureStyles.toolButton} onClick={() => pickRandom(1)}>
          Pick a friendly robot
        </button>
        <button type="button" className={figureStyles.toolButton} onClick={() => pickRandom(0)}>
          Pick an unfriendly one
        </button>
      </div>

      <div className={figureStyles.withSide}>
        <div>
          <RobotGrid
            tint={labels}
            highlight={covered}
            selected={robot}
            onPick={pick}
            ariaLabel={`All 432 robots, coloured by the network's answer. The robot being explained is ringed. ${playback.caption}`}
          />
          <Legend
            items={[
              { key: 'yes', label: 'network: friendly' },
              { key: 'no', label: 'network: not friendly' },
              { key: 'rule', label: anchor ? 'covered by the anchor' : 'covered by the leading candidate' },
            ]}
          />
          <p className={figureStyles.note}>Click any robot to explain it instead. {GRID_KEY}</p>
        </div>
        <div className={figureStyles.side}>
          <div className={styles.robot}>
            <RobotPortrait robot={x} size={84} />
            <p>
              {describeRobot(x)}. The network says <b className={verdict === 1 ? styles.yes : styles.no}>{verdict === 1 ? ROBOT_CLASSES.yes : ROBOT_CLASSES.no}</b>.
            </p>
          </div>
          {anchorRule && anchor ? (
            <div className={styles.answer}>
              <p className={styles.answerTitle}>The anchor</p>
              <RuleView rules={[anchorRule]} features={ROBOT_FEATURES} classes={ROBOT_CLASSES} kind="set" alone />
              <p className={figureStyles.note}>…whatever its other traits.</p>
              <dl className={styles.numbers}>
                <div>
                  <dt>Precision, estimated from samples</dt>
                  <dd>
                    {pct(anchor.mean)} <span className={styles.interval}>(at least {pct(anchor.lower)})</span>
                  </dd>
                </div>
                <div>
                  <dt>Precision, checked on all 432 robots</dt>
                  <dd>{exactPrecision === null ? '–' : pct(exactPrecision)}</dd>
                </div>
                <div>
                  <dt>Coverage</dt>
                  <dd>{pct(anchor.coverage)} of robots</dd>
                </div>
              </dl>
            </div>
          ) : (
            <Candidates round={round} robot={x} />
          )}
        </div>
      </div>
      <PlayerControls playback={playback} />
      <Caption>{playback.caption}</Caption>
    </Figure>
  );
}

function Candidates({ round, robot }: { round: View['round']; robot: readonly number[] }) {
  if (!round) return <p className={figureStyles.note}>Candidates appear here as the search runs.</p>;
  const order = round.candidates.map((_, i) => i).sort((a, b) => round.candidates[b].mean - round.candidates[a].mean);
  return (
    <div className={styles.candidates} tabIndex={0} role="group" aria-label="Candidate rules">
      <p className={styles.answerTitle}>Candidates with {round.length} condition{round.length === 1 ? '' : 's'}</p>
      <ol>
        {order.slice(0, SHOWN).map((i) => {
          const c = round.candidates[i];
          const isAnchor = round.anchors.includes(i);
          const kept = round.beam.includes(i);
          return (
            <li key={c.features.join()} className={isAnchor ? styles.isAnchor : kept ? styles.kept : undefined}>
              <span className={styles.ruleText}>{c.features.map((f) => ROBOT_FEATURES[f].describe!(robot[f], true)).join(' + ')}</span>
              <span className={styles.precision} title={`between ${pct(c.lower)} and ${pct(c.upper)}`} aria-label={`precision about ${pct(c.mean)}, between ${pct(c.lower)} and ${pct(c.upper)}, from ${c.samples} samples`}>
                <span className={styles.ci} style={{ left: `${c.lower * 100}%`, width: `${(c.upper - c.lower) * 100}%` }} />
                <span className={styles.dot} style={{ left: `${c.mean * 100}%` }} />
                <span className={styles.tau} />
              </span>
              <span className={styles.meta}>
                {pct(c.mean)} · {c.samples} asked{isAnchor ? ' · anchor ✓' : kept ? ' · kept' : ''}
              </span>
            </li>
          );
        })}
      </ol>
      {round.candidates.length > SHOWN && <p className={figureStyles.note}>…and {round.candidates.length - SHOWN} more. The bar shows each estimate and its confidence range; the line marks 95%.</p>}
    </div>
  );
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
