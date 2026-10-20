import { useMemo, useState, type ReactNode } from 'react';
import { makeEncoder } from '../core/data/dataset';
import { ALL_ROBOTS, monkTrainingSet, monkTruth, ROBOT_CLASSES, ROBOT_FEATURES } from '../core/data/robots';
import { extractNetwork, type Conjunction } from '../core/extract/networkRules';
import { Mlp, Trainer } from '../core/models/mlp';
import { hasBit } from '../core/rules/bitset';
import { agreement } from '../core/rules/metrics';
import type { Rule } from '../core/rules/rule';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure, Legend } from '../viz/Figure';
import { PlayerControls } from '../viz/PlayerControls';
import { GRID_KEY } from '../viz/robots/layout';
import { RobotGrid } from '../viz/robots/RobotGrid';
import { RuleView } from '../viz/RuleView';
import { Scorecard } from '../viz/Scorecard';
import { handlePlaybackKeys, useStepper } from '../viz/usePlayback';
import figureStyles from './figures.module.css';
import styles from './ExtractNetwork.module.css';

const HIDDEN = 4;
const SHOWN = 4;
const encoder = makeEncoder(ROBOT_FEATURES);

/** A network with on/off-like (sigmoid) hidden units, as the 1990s methods assumed, trained on Puzzle 1. */
function trainRobotNetwork(seed: number) {
  const data = monkTrainingSet(1, 1);
  const net = new Mlp(encoder.size, [HIDDEN], { seed, activation: 'sigmoid' });
  const trainer = new Trainer(net, data.X.map((x) => encoder.encode(x)), data.y, { learningRate: 0.03, batchSize: 16, seed, l2: 0.0005 });
  for (let e = 0; e < 400; e++) trainer.epoch();
  return net;
}

const asRules = (conjunctions: readonly Conjunction[]): Rule[] => conjunctions.map((c) => ({ tests: c.tests, prediction: 1 }));
const covers = (conjunctions: readonly Conjunction[]) => ALL_ROBOTS.map((_, i) => conjunctions.some((c) => hasBit(c.coverage, i)));

export function ExtractNetworkFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <ExtractNetwork number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function ExtractNetwork({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [seed, setSeed] = useState(1);
  const truth = useMemo(() => monkTruth(1), []);
  const { net, predictions, extraction } = useMemo(() => {
    const net = trainRobotNetwork(seed);
    const predictions = ALL_ROBOTS.map((x) => (net.predict(encoder.encode(x)) >= 0.5 ? 1 : 0));
    return { net, predictions, extraction: extractNetwork(net, encoder, ROBOT_FEATURES, ALL_ROBOTS) };
  }, [seed]);

  const stages = HIDDEN + 4;
  const playback = useStepper(stages - 1, seed);
  const stage = playback.step;
  const unit = stage >= 1 && stage <= HIDDEN ? extraction.units[stage - 1] : null;
  const final = stage === stages - 1;
  const finalPredictions = ALL_ROBOTS.map((_, i) => (extraction.simplified.some((c) => hasBit(c.coverage, i)) ? 1 : 0));
  const fidelity = agreement(finalPredictions, predictions);
  const accuracy = agreement(finalPredictions, truth);
  const networkRight = agreement(predictions, truth) * 432;

  const highlight = unit ? covers(unit.on) : stage === HIDDEN + 1 || stage === HIDDEN + 2 ? extraction.binarized.map((b) => b === 1) : final ? finalPredictions.map((p) => p === 1) : null;
  const outputText = (rule: (typeof extraction.outputRules)[number]) =>
    rule.length === 0 ? 'always' : rule.map((l) => `unit ${l.input + 1} is ${l.value === 1 ? 'on' : 'off'}`).join(' AND ');

  let caption: string;
  if (stage === 0) caption = `A network with ${HIDDEN} hidden units, trained on Puzzle 1. It gets ${networkRight} of the 432 robots right. Step forward to take it apart.`;
  else if (unit)
    caption = `Hidden unit ${unit.unit + 1}: ${unit.on.length} minimal rules switch it on and ${unit.off.length} switch it off, found by testing all ${extraction.space.toLocaleString('en')} combinations of conditions twice. The outlined robots are the ones that switch it on.`;
  else if (stage === HIDDEN + 1)
    caption = `Now treat each hidden unit as an on/off switch and read the output neuron the same way: ${extraction.outputRules.length} rule${extraction.outputRules.length === 1 ? '' : 's'} in terms of the units.`;
  else if (stage === HIDDEN + 2)
    caption = `Substitute: each output rule becomes every combination of the hidden-unit rules it needs. That gives ${extraction.substituted.toLocaleString('en')} rules about robots before any tidying.`;
  else
    caption = `Tidied up: ${extraction.simplified.length} rules, ${(fidelity * 100).toFixed(1).replace(/\.0$/, '')}% faithful to the network${fidelity < 1 ? ' (the units are not perfect on/off switches, so a few robots differ)' : ''}.`;

  return (
    <Figure number={number} title="Extract a whole network, layer by layer" tryThis={tryThis} onKeyDown={(e) => handlePlaybackKeys(e, playback)}>
      <div className={figureStyles.toolbar}>
        <button type="button" className={figureStyles.toolButton} onClick={() => setSeed((s) => s + 1)}>
          Train a new network
        </button>
        <span className={styles.seed}>Network #{seed}</span>
      </div>

      <ol className={styles.stages} aria-label="Stages">
        {['The network', ...extraction.units.map((u) => `Unit ${u.unit + 1}`), 'Output', 'Substitute', 'Tidy'].map((name, i) => (
          <li key={name} className={i === stage ? styles.current : i < stage ? styles.done : undefined}>
            <button type="button" onClick={() => playback.seek(i)} aria-current={i === stage ? 'step' : undefined}>
              {name}
            </button>
          </li>
        ))}
      </ol>

      <div className={figureStyles.withSide}>
        <div>
          <RobotGrid tint={predictions} highlight={highlight} wrong={final ? finalPredictions.map((p, i) => p !== predictions[i]) : undefined} ariaLabel={`The network's answers for all robots. ${caption}`} />
          <Legend
            items={[
              { key: 'yes', label: 'network says friendly' },
              { key: 'no', label: 'network says not friendly' },
              { key: 'rule', label: unit ? 'unit is on' : 'the rules say friendly' },
              ...(final ? [{ key: 'disagree' as const, label: 'rules and network disagree' }] : []),
            ]}
          />
          <p className={figureStyles.note}>{GRID_KEY}</p>
        </div>
        <div className={figureStyles.side}>
          {stage === 0 && (
            <div className={styles.panel}>
              <p>
                <b>{net.parameterCount}</b> numbers: {encoder.size} inputs × {HIDDEN} hidden units, plus biases and {HIDDEN} output weights.
              </p>
              <p className={figureStyles.note}>These hidden units use a sigmoid, an S-shaped curve that is close to a switch: mostly fully off or fully on. The 1990s methods relied on that.</p>
            </div>
          )}
          {unit && (
            <div className={styles.panel}>
              <p className={styles.panelTitle}>
                Unit {unit.unit + 1} switches on when… <span className={styles.count}>{unit.on.length} rules</span>
              </p>
              <RuleView rules={asRules(unit.on.slice(0, SHOWN))} features={ROBOT_FEATURES} classes={{ yes: 'on', no: 'off' }} kind="set" />
              {unit.on.length > SHOWN && <p className={figureStyles.note}>…and {unit.on.length - SHOWN} more.</p>}
              <p className={figureStyles.note}>Combinations tested for this unit: {unit.examined.toLocaleString('en')}</p>
            </div>
          )}
          {stage === HIDDEN + 1 && (
            <div className={styles.panel}>
              <p className={styles.panelTitle}>The output says friendly when…</p>
              <ol className={styles.outputRules}>
                {extraction.outputRules.map((rule, i) => (
                  <li key={i}>IF {outputText(rule)}</li>
                ))}
              </ol>
            </div>
          )}
          {stage === HIDDEN + 2 && (
            <div className={styles.panel}>
              <p className={styles.big}>{extraction.substituted.toLocaleString('en')}</p>
              <p>rules about robots, from {extraction.outputRules.length} output rule{extraction.outputRules.length === 1 ? '' : 's'} × the rules for each unit they mention.</p>
              <p className={figureStyles.note}>
                For example, “unit 1 on AND unit 2 off” becomes every pairing of a rule for unit 1 on with a rule for unit 2 off. Many are duplicates or contradictions, but
                finding out which takes more work again.
              </p>
            </div>
          )}
          {final && (
            <>
              <Scorecard score={{ fidelity, accuracy, rules: extraction.simplified.length, conditions: extraction.simplified.reduce((s, c) => s + c.tests.length, 0) }} />
              <div className={styles.panel}>
                <RuleView rules={asRules(extraction.simplified)} features={ROBOT_FEATURES} classes={ROBOT_CLASSES} kind="set" />
              </div>
              <p className={figureStyles.note}>
                Tidying: of the {extraction.primes} shortest rules that fit inside the network’s “friendly” robots, the fewest that cover them all.
              </p>
            </>
          )}
        </div>
      </div>
      <PlayerControls playback={playback} />
      <Caption>{caption}</Caption>
    </Figure>
  );
}
