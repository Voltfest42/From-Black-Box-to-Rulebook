import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { href, slugify, useRoute } from '../router';
import styles from './content.module.css';

const CALLOUT_LABELS = { key: 'Key idea', note: 'Note', ahead: 'Coming up' } as const;

/** A highlighted box for the one idea a section hinges on. */
export function Callout({ kind = 'key', title, children }: { kind?: keyof typeof CALLOUT_LABELS; title?: string; children: ReactNode }) {
  return (
    <aside className={`${styles.callout} ${styles[kind]}`}>
      <p className={styles.calloutLabel}>{title ?? CALLOUT_LABELS[kind]}</p>
      {children}
    </aside>
  );
}

/** Optional technical detail, collapsed by default. */
export function DeepDive({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className={styles.deepDive}>
      <summary>
        <span className={styles.deepLabel}>Deep dive</span> {title}
      </summary>
      <div className={styles.deepBody}>{children}</div>
    </details>
  );
}

/** Section heading with a stable id (from its text) and a link to itself. */
export function SectionHeading({ children, ...rest }: ComponentPropsWithoutRef<'h2'>) {
  const route = useRoute();
  const id = slugify(textOf(children));
  return (
    <h2 id={id} className={styles.heading} {...rest}>
      {children}
      <a href={href(route.page, id)} className={styles.anchor} aria-label="Link to this section">
        #
      </a>
    </h2>
  );
}

/** Links leaving the site open in a new tab. */
export function ContentLink({ href: target = '', children, ...rest }: ComponentPropsWithoutRef<'a'>) {
  const external = /^https?:/.test(target);
  return (
    <a href={target} {...rest} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      {children}
    </a>
  );
}

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (node && typeof node === 'object' && 'props' in node) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

/** A rule shown on its own, like an index card, with where it came from. */
export function RuleCard({ children, source }: { children: ReactNode; source?: ReactNode }) {
  return (
    <aside className={styles.ruleCard}>
      <p className={styles.ruleText}>{children}</p>
      {source && <p className={styles.ruleSource}>{source}</p>}
    </aside>
  );
}
