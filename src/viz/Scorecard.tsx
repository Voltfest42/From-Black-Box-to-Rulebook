import type { ReactNode } from 'react';
import { Term } from '../site/content/Term';
import styles from './Scorecard.module.css';

export interface Score {
  /** Agreement with the model (0–1); null when there is no model to compare with. */
  fidelity?: number | null;
  /** Agreement with reality (0–1). */
  accuracy?: number | null;
  rules: number;
  conditions: number;
}

/**
 * The three numbers every figure reports: fidelity (agrees with the model),
 * accuracy (agrees with reality) and size (how much there is to read).
 */
export function Scorecard({ score, compact = false }: { score: Score; compact?: boolean }) {
  const { fidelity, accuracy, rules, conditions } = score;
  return (
    <dl className={`${styles.card} ${compact ? styles.compact : ''}`}>
      {fidelity !== undefined && (
        <Meter label={<Term id="fidelity">Fidelity</Term>} hint="agrees with the model" value={fidelity} />
      )}
      {accuracy !== undefined && (
        <Meter label={<Term id="accuracy">Accuracy</Term>} hint="agrees with reality" value={accuracy} />
      )}
      <div className={styles.row}>
        <dt>
          Size <span className={styles.hint}>to read</span>
        </dt>
        <dd className={styles.size}>
          <b>{rules}</b> rule{rules === 1 ? '' : 's'}, <b>{conditions}</b> condition{conditions === 1 ? '' : 's'}
        </dd>
      </div>
    </dl>
  );
}

function Meter({ label, hint, value }: { label: ReactNode; hint: string; value: number | null }) {
  return (
    <div className={styles.row}>
      <dt>
        {label} <span className={styles.hint}>{hint}</span>
      </dt>
      <dd>
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.fill} style={{ width: `${(value ?? 0) * 100}%` }} />
        </span>
        <b className={styles.value}>{value === null ? '–' : `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`}</b>
      </dd>
    </div>
  );
}
