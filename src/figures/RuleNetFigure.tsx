import { useMemo, useState, type ReactNode } from 'react';
import { makeEncoder } from '../core/data/dataset';
import { ALL_ROBOTS, monkTrainingSet, monkTruth, ROBOT_CLASSES, ROBOT_FEATURES } from '../core/data/robots';
import { DnfNet } from '../core/learn/dnfNet';
import { agreement } from '../core/rules/metrics';
import type { Rule, Test } from '../core/rules/rule';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure } from '../viz/Figure';
import { LossChart } from '../viz/LossChart';
import { RuleView } from '../viz/RuleView';
import { Scorecard } from '../viz/Scorecard';
import { useTraining } from '../viz/useTraining';
import figureStyles from './figures.module.css';
import styles from './RuleNetFigure.module.css';

const EPOCHS = 600;
const UNITS = 6;
const encoder = makeEncoder(ROBOT_FEATURES);
const encodedRobots = ALL_ROBOTS.map((x) => Array.from(encoder.encode(x)));

/** Input i of the one-hot encoding as a test: "jacket is red". */
const literalTests: Test[] = ROBOT_FEATURES.flatMap((f, feature) => f.values.map((_, value): Test => ({ kind: 'cat', feature, value, equal: true })));

export function RuleNetFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <RuleNet number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function RuleNet({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [seed, setSeed] = useState(1);
  const data = useMemo(() => monkTrainingSet(1, 1), []);
  const truth = useMemo(() => monkTruth(1), []);
  const run = useTraining(() => new DnfNet(data.X.map((x) => Array.from(encoder.encode(x))), data.y, { rules: UNITS, seed }), `rulenet-${seed}`, EPOCHS, 10);
  const net = run.trainer;

  const extracted = net.extract();
  const rules: Rule[] = extracted.map((literals) => ({ tests: literals.map((i) => literalTests[i]), prediction: 1 }));
  const predictions = encodedRobots.map((v) => (extracted.some((r) => r.every((i) => v[i] === 1)) ? 1 : 0));
  const soft = encodedRobots.map((v) => (net.forward(v).out >= 0.5 ? 1 : 0));
  const accuracy = agreement(predictions, truth);
  const fidelity = agreement(predictions, soft);
  const conditions = rules.reduce((s, r) => s + r.tests.length, 0);

  const caption =
    run.epoch === 0
      ? `${UNITS} AND units with random, fuzzy memberships. Press Train: gradient descent will adjust every membership a little at a time, as in any network.`
      : !run.done
        ? `Training, round ${run.epoch} of ${EPOCHS}. Memberships drift towards 0 or 1 as the penalty for using literals bites.`
        : `Rounded to rules: ${rules.length} rules with ${conditions} conditions, right about ${Math.round(accuracy * 432)} of all 432 robots${accuracy === 1 ? ': exactly the hidden rule, learned by gradient descent' : ''}. The rounded rules agree with the fuzzy network on ${Math.round(fidelity * 100)}% of robots.`;

  return (
    <Figure number={number} title="A network that is a rule: AND units, an OR, and gradient descent" tryThis={tryThis}>
      <div className={figureStyles.toolbar}>
        <button type="button" className={`${figureStyles.toolButton} ${styles.primary}`} onClick={run.playing ? run.pause : run.done ? () => setSeed((s) => s + 1) : run.play}>
          {run.playing ? 'Pause' : run.done ? 'Train a new network' : run.epoch > 0 ? 'Continue training' : '▶ Train'}
        </button>
        {!run.done && (
          <button type="button" className={figureStyles.toolButton} onClick={run.finish}>
            Skip to the end
          </button>
        )}
        <span className={figureStyles.note}>
          Round {run.epoch} / {EPOCHS} · Puzzle 1, the same 124 training robots as Chapter 1
        </span>
      </div>

      <div className={styles.matrixWrap} tabIndex={0} role="group" aria-label="Memberships of each literal in each AND unit">
        <table className={styles.matrix}>
          <thead>
            <tr>
              <th scope="col">Unit</th>
              {encoder.inputNames.map((name) => (
                <th key={name} scope="col" className={styles.literal}>
                  <span>{name.replace(' = ', ': ')}</span>
                </th>
              ))}
              <th scope="col">in the OR</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: UNITS }, (_, k) => (
              <tr key={k}>
                <th scope="row">AND {k + 1}</th>
                {encoder.inputNames.map((name, i) => {
                  const w = net.membership(k, i);
                  return (
                    <td key={name} title={`${name}: ${w.toFixed(2)}`}>
                      <span className={styles.cell} style={{ opacity: 0.08 + 0.92 * w }} />
                    </td>
                  );
                })}
                <td title={net.ruleWeight(k).toFixed(2)}>
                  <span className={`${styles.cell} ${styles.orCell}`} style={{ opacity: 0.08 + 0.92 * net.ruleWeight(k) }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={figureStyles.note}>Each square is how strongly a unit requires that literal: solid = required, faint = not. A unit only counts if it is in the OR (last column).</p>

      <div className={styles.bottom}>
        <div>
          <p className={styles.heading}>Read off as rules (memberships rounded)</p>
          <RuleView rules={rules} features={ROBOT_FEATURES} classes={ROBOT_CLASSES} kind="set" empty="Nothing rounds up to a rule yet." />
        </div>
        <div className={figureStyles.side}>
          <Scorecard score={{ fidelity, accuracy, rules: rules.length, conditions }} compact />
          <LossChart losses={run.losses} epochs={EPOCHS} />
        </div>
      </div>
      <Caption>{caption}</Caption>
    </Figure>
  );
}
