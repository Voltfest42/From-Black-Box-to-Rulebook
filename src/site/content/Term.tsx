import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { GLOSSARY, type GlossaryId } from '../glossary';
import styles from './content.module.css';

const EDGE = 8;

/** A word with a plain-language definition on hover, focus or tap. */
export function Term({ id, children }: { id: GlossaryId; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [shift, setShift] = useState(0);
  const tipId = useId();
  const tipRef = useRef<HTMLSpanElement>(null);

  // Keep an open tooltip inside the window: near the edges, slide it sideways.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!open || !tip) return;
    // Where the tooltip would be with no shift at all.
    const current = Number.parseFloat(getComputedStyle(tip).getPropertyValue('--shift')) || 0;
    const rect = tip.getBoundingClientRect();
    const left = rect.left - current;
    const right = rect.right - current;
    const limit = document.documentElement.clientWidth - EDGE;
    setShift(right > limit ? limit - right : left < EDGE ? EDGE - left : 0);
  }, [open]);

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
      <span
        ref={tipRef}
        role="tooltip"
        id={tipId}
        className={`${styles.tip} ${open ? styles.tipOpen : ''}`}
        style={{ '--shift': `${shift}px` } as CSSProperties}
      >
        {GLOSSARY[id]}
      </span>
    </span>
  );
}
