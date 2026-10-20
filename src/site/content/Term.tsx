import { useId, useState, type ReactNode } from 'react';
import { GLOSSARY, type GlossaryId } from '../glossary';
import styles from './content.module.css';

/** A word with a plain-language definition on hover, focus or tap. */
export function Term({ id, children }: { id: GlossaryId; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  return (
    <span className={styles.term} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        className={styles.termButton}
        aria-describedby={tipId}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      >
        {children}
      </button>
      <span role="tooltip" id={tipId} className={`${styles.tip} ${open ? styles.tipOpen : ''}`}>
        {GLOSSARY[id]}
      </span>
    </span>
  );
}
