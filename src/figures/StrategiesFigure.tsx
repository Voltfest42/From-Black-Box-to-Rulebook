import type { ReactNode } from 'react';
import { CHAPTERS } from '../site/chapters';
import { href } from '../site/router';
import { Figure } from '../viz/Figure';
import styles from './StrategiesFigure.module.css';

interface Strategy {
  chapter: string;
  name: string;
  how: string;
  bargain: string;
  icon: ReactNode;
}

const STRATEGIES: Strategy[] = [
  {
    chapter: 'opening-the-box',
    name: 'Open the box',
    how: 'Look inside: read rules straight off the weights, one neuron at a time.',
    bargain: 'Faithful to the mechanism, but the number of rules explodes.',
    icon: (
      <>
        <rect x="6" y="14" width="30" height="24" rx="3" className={styles.box} />
        <circle cx="38" cy="22" r="9" className={styles.lens} />
        <line x1="44.5" y1="28.5" x2="52" y2="36" className={styles.stroke} />
        <circle cx="15" cy="22" r="2.5" className={styles.dot} />
        <circle cx="15" cy="31" r="2.5" className={styles.dot} />
        <circle cx="27" cy="26" r="2.5" className={styles.dot} />
        <path d="M15 22 L27 26 L15 31" className={styles.thin} />
      </>
    ),
  },
  {
    chapter: 'questioning-the-box',
    name: 'Question the box',
    how: 'Treat the model as an oracle: ask it about many cases and learn a small model of its answers.',
    bargain: 'Works on any model and stays short, but it is a copy, not the original.',
    icon: (
      <>
        <rect x="18" y="12" width="20" height="26" rx="3" className={styles.filled} />
        <path d="M4 20 H15 M12 17 L15 20 L12 23" className={styles.stroke} />
        <path d="M41 30 H52 M49 27 L52 30 L49 33" className={styles.stroke} />
        <text x="6" y="14" className={styles.glyph}>?</text>
        <text x="44" y="24" className={styles.glyph}>!</text>
      </>
    ),
  },
  {
    chapter: 'one-decision',
    name: 'Explain one decision',
    how: 'Find a short rule that holds near one particular case, and what would change it.',
    bargain: 'Short and faithful, but only about that case.',
    icon: (
      <>
        <circle cx="28" cy="26" r="17" className={styles.ring} />
        <circle cx="28" cy="26" r="9" className={styles.ring} />
        <circle cx="28" cy="26" r="3" className={styles.dot} />
      </>
    ),
  },
  {
    chapter: 'rules-by-design',
    name: 'Build the box from rules',
    how: 'Skip the black box: search directly for the best short rule list.',
    bargain: 'Exact and readable, but only when the data has features worth writing rules about.',
    icon: (
      <>
        <rect x="10" y="10" width="36" height="8" rx="2" className={styles.box} />
        <rect x="10" y="22" width="30" height="8" rx="2" className={styles.box} />
        <rect x="10" y="34" width="24" height="8" rx="2" className={styles.box} />
      </>
    ),
  },
];

export function StrategiesFigure({ number }: { number: string }) {
  return (
    <Figure number={number} title="Four ways to get rules out of a model">
      <ol className={styles.grid}>
        {STRATEGIES.map((s) => {
          const chapter = CHAPTERS.find((c) => c.slug === s.chapter)!;
          return (
            <li key={s.name} className={styles.card}>
              <svg viewBox="0 0 56 48" width="56" height="48" aria-hidden="true" className={styles.icon}>
                {s.icon}
              </svg>
              <h3 className={styles.name}>{s.name}</h3>
              <p>{s.how}</p>
              <p className={styles.bargain}>
                <b>The bargain:</b> {s.bargain}
              </p>
              <a href={href(chapter.slug)} className={styles.link}>
                Chapter {chapter.number} · {chapter.era} →
              </a>
            </li>
          );
        })}
      </ol>
    </Figure>
  );
}
