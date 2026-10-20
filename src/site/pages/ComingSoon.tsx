import { CHAPTERS } from '../chapters';
import { href } from '../router';
import styles from './pages.module.css';

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  const first = CHAPTERS[0];
  return (
    <article className={styles.page}>
      <header className={styles.chapterHeader}>
        <p className={styles.kicker}>Coming soon</p>
        <h1>{title}</h1>
        <p className={styles.lede}>{blurb}</p>
      </header>
      <p>This part of the story is still being written. In the meantime, you can start from the beginning.</p>
      <p>
        <a href={href(first.slug)}>
          Go to Chapter {first.number}: {first.title} →
        </a>
      </p>
    </article>
  );
}

export function NotFound() {
  return (
    <article className={styles.page}>
      <header className={styles.chapterHeader}>
        <p className={styles.kicker}>Not found</p>
        <h1>There's no page here</h1>
      </header>
      <p>
        The link may be mistyped. <a href={href('')}>Go to the start page →</a>
      </p>
    </article>
  );
}
