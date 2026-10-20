import { useMemo, useState, type ReactNode } from 'react';
import { ALL_ROBOTS, BODY, describeRobot, HEAD, monkTruth, ROBOT_CLASSES, ROBOT_FEATURES, type MonkProblem } from '../core/data/robots';
import { fires, ruleSize, type Rule, type Test } from '../core/rules/rule';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Caption, Figure, Legend } from '../viz/Figure';
import { RobotPortrait } from '../viz/robots/RobotPortrait';
import { GRID_KEY } from '../viz/robots/layout';
import { RobotGrid } from '../viz/robots/RobotGrid';
import { RuleView } from '../viz/RuleView';
import { Scorecard } from '../viz/Scorecard';
import { hiddenRuleSet, ruleStats, setCorrect } from './robotRules';
import figureStyles from './figures.module.css';
import styles from './GuessTheRule.module.css';

const PUZZLES: { problem: MonkProblem; label: string }[] = [
  { problem: 1, label: 'Puzzle 1' },
  { problem: 3, label: 'Puzzle 2' },
  { problem: 2, label: 'Puzzle 3 (hard)' },
];

const MAX_RULES = 4;

type ChipState = 'off' | 'is' | 'not';

export function GuessTheRuleFigure({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  return (
    <ErrorBoundary what={`Figure ${number}`}>
      <GuessTheRule number={number} tryThis={tryThis} />
    </ErrorBoundary>
  );
}

function GuessTheRule({ number, tryThis }: { number: string; tryThis?: ReactNode }) {
  const [problem, setProblem] = useState<MonkProblem>(1);
  const [rules, setRules] = useState<Test[][]>([[]]);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const truth = useMemo(() => monkTruth(problem), [problem]);
  const asRules: Rule[] = rules.filter((tests) => tests.length > 0).map((tests) => ({ tests, prediction: 1 }));
  const covered = ALL_ROBOTS.map((x) => asRules.some((r) => fires(r, x)));
  const correct = setCorrect(asRules, truth);
  const size = ruleSize(asRules);
  const current = rules[Math.min(active, rules.length - 1)];

  const choosePuzzle = (p: MonkProblem) => {
    setProblem(p);
    setRules([[]]);
    setActive(0);
    setRevealed(false);
  };

  const updateActive = (change: (tests: Test[]) => Test[]) => {
    setRevealed(false);
    setRules((all) => all.map((tests, i) => (i === active ? change(tests) : tests)));
  };

  const chipState = (feature: number, value: number): ChipState => {
    const test = current.find((t) => t.kind === 'cat' && t.feature === feature && t.value === value);
    return !test || test.kind !== 'cat' ? 'off' : test.equal ? 'is' : 'not';
  };
  const sameState: ChipState = (() => {
    const test = current.find((t) => t.kind === 'same');
    return !test || test.kind !== 'same' ? 'off' : test.equal ? 'is' : 'not';
  })();

  // Each click cycles: off → "is" → "is not" → off. Choosing "is" for one value clears
  // the other tests on that trait, since a robot has only one value per trait.
  const cycleChip = (feature: number, value: number) =>
    updateActive((tests) => {
      const state = chipState(feature, value);
      const others = tests.filter((t) => !(t.kind === 'cat' && t.feature === feature && t.value === value));
      if (state === 'off') {
        return [...others.filter((t) => !(t.kind === 'cat' && t.feature === feature)), { kind: 'cat', feature, value, equal: true }];
      }
      if (state === 'is') {
        const binary = ROBOT_FEATURES[feature].values.length === 2;
        // For yes/no traits "not yes" is just "no": go straight back to off.
        return binary ? others : [...others, { kind: 'cat', feature, value, equal: false }];
      }
      return others;
    });

  const cycleSame = () =>
    updateActive((tests) => {
      const others = tests.filter((t) => t.kind !== 'same');
      if (sameState === 'off') return [...others, { kind: 'same', feature: HEAD, other: BODY, equal: true }];
      if (sameState === 'is') return [...others, { kind: 'same', feature: HEAD, other: BODY, equal: false }];
      return others;
    });

  const reveal = () => {
    setRules(hiddenRuleSet(problem).map((r) => [...r.tests]));
    setActive(0);
    setRevealed(true);
  };

  const hoveredRobot = hovered === null ? null : ALL_ROBOTS[hovered];
  const status = (() => {
    if (asRules.length === 0) return 'Pick some conditions below to build a rule. The robots it covers are outlined in the grid.';
    const wrongYes = covered.filter((c, i) => c && truth[i] === 0).length;
    const missed = covered.filter((c, i) => !c && truth[i] === 1).length;
    if (correct === ALL_ROBOTS.length) return `Every one of the 432 robots is labelled correctly${revealed ? ': this is the hidden rule' : '. You found the hidden rule'}!`;
    return `Your rules call ${covered.filter(Boolean).length} robots friendly. ${wrongYes} of those aren't, and they miss ${missed} friendly robots.`;
  })();

  return (
    <Figure number={number} title="Guess the rule: which robots are friendly?" tryThis={tryThis}>
      <div className={figureStyles.toolbar}>
        <span className={figureStyles.segmented} role="group" aria-label="Puzzle">
          {PUZZLES.map((p) => (
            <button key={p.problem} type="button" aria-pressed={problem === p.problem} onClick={() => choosePuzzle(p.problem)}>
              {p.label}
            </button>
          ))}
        </span>
        <button type="button" className={figureStyles.toolButton} onClick={reveal}>
          Reveal the hidden rule
        </button>
        <button
          type="button"
          className={figureStyles.toolButton}
          onClick={() => {
            setRules([[]]);
            setActive(0);
            setRevealed(false);
          }}
        >
          Clear
        </button>
      </div>

      <div className={figureStyles.withSide}>
        <div>
          <RobotGrid
            tint={truth}
            highlight={asRules.length > 0 ? covered : null}
            hovered={hovered}
            onHover={setHovered}
            ariaLabel={`All 432 robots; ${truth.filter((y) => y === 1).length} are friendly. ${status}`}
          />
          <Legend items={[{ key: 'yes', label: 'friendly' }, { key: 'no', label: 'not friendly' }, { key: 'rule', label: 'covered by your rules' }]} />
          <p className={figureStyles.note}>{GRID_KEY}</p>
        </div>

        <div className={figureStyles.side}>
          <div className={styles.portraitBox}>
            {hoveredRobot ? (
              <>
                <RobotPortrait robot={hoveredRobot} size={96} />
                <div>
                  <p className={styles.robotName}>{describeRobot(hoveredRobot)}.</p>
                  <p>
                    <b className={truth[hovered!] === 1 ? styles.yesText : styles.noText}>{truth[hovered!] === 1 ? 'Friendly' : 'Not friendly'}</b>
                    {asRules.length > 0 && <>, {covered[hovered!] ? 'covered' : 'not covered'} by your rules</>}
                  </p>
                </div>
              </>
            ) : (
              <p className={styles.hint}>Point at a robot to see it up close.</p>
            )}
          </div>
          <Scorecard score={{ accuracy: correct / ALL_ROBOTS.length, rules: size.rules, conditions: size.conditions }} compact />
        </div>
      </div>

      <div className={styles.editor}>
        <div className={styles.tabs}>
          <div className={styles.tabList} role="tablist" aria-label="Rules">
            {rules.map((tests, i) => {
              const stats = tests.length > 0 ? ruleStats({ tests, prediction: 1 }, truth) : null;
              return (
                <button key={i} type="button" role="tab" aria-selected={i === active} className={styles.tab} onClick={() => setActive(i)}>
                  Rule {i + 1}
                  {stats && (
                    <span className={styles.tabStats}>
                      {stats.covered} robots, {stats.covered === 0 ? '–' : `${Math.round((100 * stats.right) / stats.covered)}% right`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {rules.length < MAX_RULES && !revealed && (
            <button
              type="button"
              className={styles.addTab}
              onClick={() => {
                setRules((all) => [...all, []]);
                setActive(rules.length);
              }}
            >
              + Add a rule
            </button>
          )}
        </div>

        <div className={styles.chips} role="tabpanel" aria-label={`Conditions of rule ${active + 1}`}>
          {ROBOT_FEATURES.map((feature, f) => (
            <div key={feature.name} className={styles.trait}>
              <span className={styles.traitName}>{feature.name}</span>
              {feature.values.map((value, v) => {
                const state = chipState(f, v);
                return (
                  <button
                    key={value}
                    type="button"
                    className={`${styles.chip} ${styles[state]}`}
                    aria-pressed={state !== 'off'}
                    aria-label={`${feature.name} ${state === 'not' ? 'is not' : 'is'} ${value}`}
                    onClick={() => cycleChip(f, v)}
                  >
                    {state === 'not' && <span aria-hidden="true">not </span>}
                    {value}
                  </button>
                );
              })}
            </div>
          ))}
          <div className={styles.trait}>
            <span className={styles.traitName}>shapes</span>
            <button type="button" className={`${styles.chip} ${styles[sameState]}`} aria-pressed={sameState !== 'off'} onClick={cycleSame}>
              {sameState === 'not' ? "head and body don't match" : 'head and body match'}
            </button>
          </div>
        </div>
        <p className={figureStyles.note}>Click a condition once for “is”, twice for “is not”, a third time to remove it.</p>
      </div>

      <div className={styles.result} tabIndex={0} role="group" aria-label="Your rules">
        <p className={styles.resultLabel}>Friendly if any of these rules applies:</p>
        <RuleView rules={asRules} features={ROBOT_FEATURES} classes={ROBOT_CLASSES} kind="set" empty="No conditions chosen yet." />
      </div>
      <Caption>{status}</Caption>
    </Figure>
  );
}
