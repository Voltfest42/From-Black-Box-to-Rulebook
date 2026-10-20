import { useMemo, useState, type ReactNode } from 'react';
import { makeEncoder } from '../core/data/dataset';
import { ALL_ROBOTS, BODY, JACKET, JACKETS, monkTrainingSet, monkTruth, ROBOT_CLASSES, ROBOT_FEATURES, SHAPES } from '../core/data/robots';
import { Mlp, Trainer } from '../core/models/mlp';
import { growTree } from '../core/models/tree';
import { agreement } from '../core/rules/metrics';
import { fires, predictSet, ruleSize, type Rule } from '../core/rules/rule';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure, Legend } from '../viz/Figure';
import { GRID_KEY } from '../viz/robots/layout';
import { RobotGrid } from '../viz/robots/RobotGrid';
import { RuleView } from '../viz/RuleView';
import { Scorecard } from '../viz/Scorecard';
import { hiddenRuleSet } from './robotRules';
import figureStyles from './figures.module.css';
import styles from './GradingFigure.module.css';

interface Candidate {
  name: string;
  blurb: string;
  rules: Rule[];
}

/** The network of Figure 1.2 on the noisy puzzle, trained the same way (seed 1). */
function trainNoisyNetwork() {
  const encoder = makeEncoder(ROBOT_FEATURES);
  const data = monkTrainingSet(3, 1);
  const net = new Mlp(encoder.size, [6], { seed: 1 });
  const trainer = new Trainer(net, data.X.map((x) => encoder.encode(x)), data.y, { learningRate: 0.02, batchSize: 32, seed: 1 });
  for (let e = 0; e < 250; e++) trainer.epoch();
  return ALL_ROBOTS.map((x) => (net.predict(encoder.encode(x)) >= 0.5 ? 1 : 0));
}

export function GradingFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <Grading number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function Grading({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const truth = useMemo(() => monkTruth(3), []);
  const network = useMemo(() => trainNoisyNetwork(), []);

  const candidates: Candidate[] = useMemo(() => {
    // A tree grown on the network's own answers for all 432 robots copies it exactly.
    const copy = growTree(ROBOT_FEATURES, ALL_ROBOTS, network).yesRules();
    return [
      { name: 'The designer’s rule', blurb: 'The hidden rule that labelled the robots.', rules: hiddenRuleSet(3) },
      {
        name: 'A short rule',
        blurb: 'One rule with two conditions.',
        rules: [
          {
            tests: [
              { kind: 'cat', feature: JACKET, value: JACKETS.blue, equal: false },
              { kind: 'cat', feature: BODY, value: SHAPES.octagon, equal: false },
            ],
            prediction: 1,
          },
        ],
      },
      {
        name: 'Shorter still',
        blurb: 'One condition.',
        rules: [{ tests: [{ kind: 'cat', feature: JACKET, value: JACKETS.blue, equal: false }], prediction: 1 }],
      },
      { name: 'An exact copy of the network', blurb: 'A decision tree grown on the network’s answers, written out as rules.', rules: copy },
    ];
  }, [network]);

  const [chosen, setChosen] = useState(0);
  const [activeRule, setActiveRule] = useState<number | null>(null);
  const candidate = candidates[chosen];
  const predictions = ALL_ROBOTS.map((x) => predictSet(candidate.rules, x));
  const fidelity = agreement(predictions, network);
  const accuracy = agreement(predictions, truth);
  const size = ruleSize(candidate.rules);
  const networkAccuracy = agreement(network, truth);
  // Rules that are mostly wrong about reality: they describe the network's mistakes.
  const mistakeRules = candidate.rules.flatMap((rule, i) => {
    const covered = ALL_ROBOTS.flatMap((x, j) => (fires(rule, x) ? [j] : []));
    const wrong = covered.filter((j) => truth[j] === 0).length;
    return covered.length > 0 && wrong / covered.length > 0.5 ? [i] : [];
  });

  const highlight = activeRule === null ? ALL_ROBOTS.map((x) => predictSet(candidate.rules, x) === 1) : ALL_ROBOTS.map((x) => fires(candidate.rules[activeRule], x));

  return (
    <Figure number={number} title="Grading rules: fidelity, accuracy and size" tryThis={tryThis}>
      <p className={styles.setup}>
        The network from Figure 1.2, trained on the noisy Puzzle 2. It gets {Math.round(networkAccuracy * 432)} of the 432 robots right. Four
        candidate rule sets claim to describe it:
      </p>
      <div className={styles.candidates} role="group" aria-label="Candidate rule sets">
        {candidates.map((c, i) => {
          const p = ALL_ROBOTS.map((x) => predictSet(c.rules, x));
          const s = ruleSize(c.rules);
          return (
            <button
              key={c.name}
              type="button"
              aria-pressed={chosen === i}
              className={styles.candidate}
              onClick={() => {
                setChosen(i);
                setActiveRule(null);
              }}
            >
              <span className={styles.candidateName}>{c.name}</span>
              <span className={styles.candidateNumbers}>
                fidelity {pct(agreement(p, network))} · accuracy {pct(agreement(p, truth))} · {s.rules} rule{s.rules === 1 ? '' : 's'}
              </span>
            </button>
          );
        })}
      </div>

      <div className={figureStyles.withSide}>
        <div>
          <RobotGrid
            tint={network}
            highlight={highlight}
            wrong={predictions.map((p, i) => p !== network[i])}
            ariaLabel={`The network's answers for all robots, with the robots where "${candidate.name}" disagrees with it marked.`}
          />
          <Legend
            items={[
              { key: 'yes', label: 'network says friendly' },
              { key: 'no', label: 'network says not friendly' },
              { key: 'rule', label: 'the rules say friendly' },
              { key: 'disagree', label: 'rules and network disagree' },
            ]}
          />
          <p className={figureStyles.note}>{GRID_KEY}</p>
        </div>
        <div className={figureStyles.side}>
          <Scorecard score={{ fidelity, accuracy, rules: size.rules, conditions: size.conditions }} />
          <p className={styles.blurb}>{candidate.blurb}</p>
          <div className={styles.rules} tabIndex={0} role="group" aria-label="Rules of this candidate">
            <RuleView
              rules={candidate.rules}
              features={ROBOT_FEATURES}
              classes={ROBOT_CLASSES}
              kind="set"
              active={activeRule}
              onHoverRule={setActiveRule}
            />
          </div>
          {mistakeRules.length > 0 && (
            <p className={figureStyles.note}>
              {mistakeRules.length === 1 ? 'Rule' : 'Rules'} {mistakeRules.map((i) => i + 1).join(', ')}{' '}
              {mistakeRules.length === 1 ? 'is' : 'are'} mostly wrong about the real robots: {mistakeRules.length === 1 ? 'it describes' : 'they describe'} the
              network’s mistakes. Point at a rule to see the robots it covers.
            </p>
          )}
        </div>
      </div>
      <Caption>{captionFor(chosen, fidelity, accuracy, size.rules)}</Caption>
    </Figure>
  );
}

function captionFor(chosen: number, fidelity: number, accuracy: number, rules: number): string {
  switch (chosen) {
    case 0:
      return `Perfect about reality (${pct(accuracy)} accuracy), but it is not what the network does: they disagree on the robots marked ×. As a description of the network, it is ${pct(fidelity)} faithful.`;
    case 1:
      return `Almost as good on both counts with half the reading: ${pct(fidelity)} fidelity and ${pct(accuracy)} accuracy from just two conditions.`;
    case 2:
      return `Very easy to read, but it misses the network’s behaviour on whole blocks of robots: only ${pct(fidelity)} fidelity.`;
    default:
      return `${pct(fidelity)} faithful: every answer of the network, including its mistakes, is written in these ${rules} rules. Too long to take in at a glance, but it shows exactly where the network learned the noise.`;
  }
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1).replace(/\.0$/, '')}%`;
}
