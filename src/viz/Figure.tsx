import type { KeyboardEventHandler, ReactNode } from 'react';
import styles from './Figure.module.css';

interface FigureProps {
  /** e.g. "1.1" */
  number: string;
  title: string;
  children: ReactNode;
  tryThis?: ReactNode;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
}

/** The frame around every interactive figure: numbered title, the demo, and a "Try this" prompt. */
export function Figure({ number, title, children, tryThis, onKeyDown }: FigureProps) {
  return (
    <figure className={styles.figure} onKeyDown={onKeyDown} aria-labelledby={`figure-${number || 'unnumbered'}`}>
      <figcaption className={styles.header} id={`figure-${number || 'unnumbered'}`}>
        {number && <span className={styles.number}>Figure {number}</span>}
        <span className={styles.title}>{title}</span>
      </figcaption>
      {children}
      {tryThis && (
        <aside className={styles.tryThis}>
          <span className={styles.tryLabel}>Try this</span>
          <div>{tryThis}</div>
        </aside>
      )}
    </figure>
  );
}

/** The step-by-step narration under a demo. Read out by screen readers as it changes. */
export function Caption({ children }: { children: ReactNode }) {
  return (
    <p className={styles.caption} aria-live="polite">
      {children}
    </p>
  );
}

export type LegendKey =
  | 'yes'
  | 'no'
  | 'modelYes'
  | 'modelNo'
  | 'rule'
  | 'disagree'
  | 'example'
  | 'query'
  | 'anchor'
  | 'counterfactual';

const LEGEND: Record<LegendKey, { label: string; symbol: ReactNode }> = {
  yes: { label: 'yes', symbol: <circle r="6" className={styles.kYes} /> },
  no: { label: 'no', symbol: <circle r="6" className={styles.kNo} /> },
  modelYes: { label: 'the model says yes', symbol: <rect x="-9" y="-9" width="18" height="18" rx="3" className={styles.kModelYes} /> },
  modelNo: { label: 'the model says no', symbol: <rect x="-9" y="-9" width="18" height="18" rx="3" className={styles.kModelNo} /> },
  rule: { label: 'where a rule applies', symbol: <rect x="-8" y="-7" width="16" height="14" rx="2" className={styles.kRule} /> },
  disagree: {
    label: 'rules and model disagree',
    symbol: <path d="M-5 -5 L5 5 M5 -5 L-5 5" className={styles.kDisagree} />,
  },
  example: { label: 'training example', symbol: <circle r="4" className={styles.kExample} /> },
  query: { label: 'made-up question to the model', symbol: <circle r="4" className={styles.kQuery} /> },
  anchor: { label: 'anchor', symbol: <rect x="-8" y="-7" width="16" height="14" rx="2" className={styles.kAnchor} /> },
  counterfactual: {
    label: 'smallest change that flips the decision',
    symbol: <path d="M-8 4 L6 -4 M6 -4 L1 -4.5 M6 -4 L3.5 0" className={styles.kCounterfactual} />,
  },
};

/** A legend entry: a standard key, optionally with a figure-specific label ("friendly", "spotted"). */
export type LegendItem = LegendKey | { key: LegendKey; label: string };

export function Legend({ items }: { items: readonly LegendItem[] }) {
  return (
    <ul className={styles.legend} aria-label="Legend">
      {items.map((item) => {
        const key = typeof item === 'string' ? item : item.key;
        const label = typeof item === 'string' ? LEGEND[key].label : item.label;
        return (
          <li key={key}>
            <svg viewBox="-11 -11 22 22" width="18" height="18" aria-hidden="true">
              {LEGEND[key].symbol}
            </svg>
            {label}
          </li>
        );
      })}
    </ul>
  );
}
