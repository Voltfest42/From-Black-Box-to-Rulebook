import { useState, type ReactNode } from 'react';
import { TIMELINE, TRACK_LABELS, type Track } from '../content/timeline';
import { ErrorBoundary } from '../site/ErrorBoundary';
import { Figure } from '../viz/Figure';
import figureStyles from './figures.module.css';
import styles from './TimelineFigure.module.css';

interface TimelineFigureProps {
  number: string;
  title: string;
  tracks: readonly Track[];
  tryThis?: ReactNode;
}

/** A filterable list of results over time; each entry expands to a short explanation. */
export function TimelineFigure(props: TimelineFigureProps) {
  return (
    <ErrorBoundary what={`Figure ${props.number}`}>
      <TimelineInner {...props} />
    </ErrorBoundary>
  );
}

function TimelineInner({ number, title, tracks, tryThis }: TimelineFigureProps) {
  const [shown, setShown] = useState<ReadonlySet<Track>>(new Set(tracks));
  const entries = TIMELINE.filter((e) => shown.has(e.track)).sort((a, b) => a.year.localeCompare(b.year));

  const toggle = (track: Track) =>
    setShown((current) => {
      const next = new Set(current);
      if (next.has(track)) next.delete(track);
      else next.add(track);
      return next.size === 0 ? current : next;
    });

  return (
    <Figure number={number} title={title} tryThis={tryThis}>
      <div className={figureStyles.toolbar} role="group" aria-label="Show results for">
        {tracks.map((track) => (
          <button
            key={track}
            type="button"
            className={`${styles.filter} ${styles[track]}`}
            aria-pressed={shown.has(track)}
            onClick={() => toggle(track)}
          >
            <span className={styles.swatch} aria-hidden="true" />
            {TRACK_LABELS[track]}
          </button>
        ))}
      </div>

      <ol className={styles.timeline}>
        {entries.map((entry) => (
          <li key={`${entry.year}-${entry.title}`} className={`${styles.entry} ${styles[entry.track]}`}>
            <span className={styles.year}>{entry.year}</span>
            <span className={styles.dot} aria-hidden="true" />
            <details className={`${styles.card} ${entry.landmark ? styles.landmark : ''}`}>
              <summary>
                <span className={styles.title}>
                  {entry.title}
                  {entry.landmark && <span className={styles.tag}>landmark</span>}
                  {entry.preprint && <span className={`${styles.tag} ${styles.preprint}`}>preprint</span>}
                </span>
                <span className={styles.who}>
                  {entry.who}
                  {entry.venue && ` · ${entry.venue}`}
                </span>
              </summary>
              <p>
                {entry.detail}{' '}
                {entry.link && (
                  <a href={entry.link} target="_blank" rel="noreferrer">
                    Paper ↗
                  </a>
                )}
              </p>
            </details>
          </li>
        ))}
      </ol>
    </Figure>
  );
}
