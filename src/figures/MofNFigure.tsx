import type { ReactNode } from 'react';
import { ALL_ROBOTS, monkTrainingSet, monkTruth, MONK_RULE_TEXT, ROBOT_CLASSES, ROBOT_FEATURES } from '../core/data/robots';
import { trepan } from '../core/extract/trepan';
import { trainNetwork } from '../core/models/blackbox';
import { walk, type DecisionTree } from '../core/models/tree';
import { agreement, labelAll } from '../core/rules/metrics';
import { testSize } from '../core/rules/rule';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Figure } from '../viz/Figure';
import { Scorecard } from '../viz/Scorecard';
import { TreeOutline } from '../viz/TreeOutline';
import { useWhenVisible } from '../viz/useWhenVisible';
import styles from './MofNFigure.module.css';

function measure(tree: DecisionTree) {
  let internal = 0;
  let symbols = 0;
  walk(tree.root, (n) => {
    if (n.test) {
      internal++;
      symbols += testSize(n.test);
    }
  });
  return { internal, symbols };
}

export function MofNFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <MofN number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function MofN({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const { ref, value: result } = useWhenVisible(() => {
    const data = monkTrainingSet(2, 1);
    const { box } = trainNetwork(data, { hidden: [6], epochs: 250, seed: 3 });
    const network = labelAll(box.label, ALL_ROBOTS);
    const truth = monkTruth(2);
    const variants = [false, true].map((mofn) => {
      const tree = trepan(ROBOT_FEATURES, data.X, box.label, { maxInternal: 15, sMin: 300, mofn, seed: 1 });
      const predicted = labelAll((x) => tree.predict(x), ALL_ROBOTS);
      return { mofn, tree, fidelity: agreement(predicted, network), accuracy: agreement(predicted, truth), ...measure(tree) };
    });
    return { variants, networkAccuracy: agreement(network, truth) };
  }, 'mofn');

  return (
    <Figure number={number} title="Asking better questions: ordinary splits against m-of-n splits" tryThis={tryThis}>
      <div ref={ref}>
        {!result ? (
          <p className={styles.setup}>Training the network and extracting two trees…</p>
        ) : (
          <>
            <p className={styles.setup}>
              Puzzle 3 from Chapter 1. Hidden rule: friendly if {MONK_RULE_TEXT[2]}. A network learns it ({Math.round(result.networkAccuracy * 432)} of 432
              right), and TREPAN extracts a tree of at most 15 questions, twice.
            </p>
            <div className={styles.columns}>
              {result.variants.map((v) => (
                <section key={String(v.mofn)} className={styles.column} aria-label={v.mofn ? 'With m-of-n splits' : 'With ordinary splits'}>
                  <h4 className={styles.heading}>{v.mofn ? 'With m-of-n questions' : 'With ordinary questions'}</h4>
                  <Scorecard score={{ fidelity: v.fidelity, accuracy: v.accuracy, rules: v.tree.yesRules().length, conditions: v.symbols }} compact />
                  <p className={styles.size}>
                    {v.internal} question{v.internal === 1 ? '' : 's'}, {v.symbols} conditions in all
                  </p>
                  <TreeOutline root={v.tree.root} features={ROBOT_FEATURES} classes={ROBOT_CLASSES} />
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </Figure>
  );
}
