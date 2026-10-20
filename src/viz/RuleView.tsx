import type { ClassNames, Feature } from '../core/data/dataset';
import { formatTest, type Rule } from '../core/rules/rule';
import styles from './RuleView.module.css';

interface RuleViewProps {
  rules: readonly Rule[];
  features: readonly Feature[];
  classes: ClassNames;
  /** "set": unordered rules for "yes"; "list": IF / ELSE IF / ELSE. */
  kind: 'set' | 'list';
  /** For lists: what the final ELSE predicts. */
  fallback?: number;
  /** Highlight one rule, e.g. the one that decides the hovered case. */
  active?: number | null;
  onHoverRule?: (index: number | null) => void;
  /** Shown when there are no rules. */
  empty?: string;
  /** Leave out the OTHERWISE / ELSE line (for a rule that says nothing about other cases, like an anchor). */
  alone?: boolean;
}

/** Rules as readable lines of condition chips. */
export function RuleView({ rules, features, classes, kind, fallback = 0, active, onHoverRule, empty = 'No rules yet.', alone = false }: RuleViewProps) {
  const verdict = (prediction: number) => (
    <span className={`${styles.verdict} ${prediction === 1 ? styles.yes : styles.no}`}>{prediction === 1 ? classes.yes : classes.no}</span>
  );

  if (rules.length === 0 && kind === 'set') return <p className={styles.empty}>{empty}</p>;

  return (
    <ol className={`${styles.rules} ${kind === 'list' ? styles.list : ''}`}>
      {rules.map((rule, i) => (
        <li
          key={i}
          className={active === i ? styles.active : undefined}
          onPointerEnter={onHoverRule ? () => onHoverRule(i) : undefined}
          onPointerLeave={onHoverRule ? () => onHoverRule(null) : undefined}
        >
          <span className={styles.keyword}>{kind === 'list' && i > 0 ? 'ELSE IF' : 'IF'}</span>
          <Conditions rule={rule} features={features} />
          <span className={styles.keyword}>THEN</span>
          {verdict(rule.prediction)}
        </li>
      ))}
      {kind === 'list' && !alone && (
        <li className={active === rules.length ? styles.active : undefined}>
          <span className={styles.keyword}>{rules.length === 0 ? 'ALWAYS' : 'ELSE'}</span>
          {verdict(fallback)}
        </li>
      )}
      {kind === 'set' && !alone && (
        <li className={styles.otherwise}>
          <span className={styles.keyword}>OTHERWISE</span>
          {verdict(0)}
        </li>
      )}
    </ol>
  );
}

export function Conditions({ rule, features }: { rule: Rule; features: readonly Feature[] }) {
  if (rule.tests.length === 0) return <span className={styles.chip}>always</span>;
  return (
    <>
      {rule.tests.map((test, j) => (
        <span key={j} className={styles.condition}>
          {j > 0 && <span className={styles.and}>AND</span>}
          <span className={styles.chip}>{formatTest(test, features)}</span>
        </span>
      ))}
    </>
  );
}
