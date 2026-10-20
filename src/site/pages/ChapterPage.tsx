import { lazy, Suspense, useEffect, useRef } from 'react';
import { CHAPTERS, type ChapterInfo } from '../chapters';
import { mdxComponents } from '../content/mdxComponents';
import { markChapterRead } from '../progress';
import { href, scrollToSection } from '../router';
import { ComingSoon } from './ComingSoon';
import contentStyles from '../content/content.module.css';
import styles from './pages.module.css';

const lazyContent = new Map(CHAPTERS.flatMap((c) => (c.load ? [[c.slug, lazy(c.load)] as const] : [])));

export function ChapterPage({ chapter, section }: { chapter: ChapterInfo; section: string | null }) {
  const Content = lazyContent.get(chapter.slug);
  if (!Content) {
    return <ComingSoon title={`Chapter ${chapter.number}: ${chapter.title}`} blurb={chapter.blurb} />;
  }

  return (
    <article className={styles.page}>
      <header className={styles.chapterHeader}>
        <p className={styles.kicker}>Chapter {chapter.number}</p>
        <h1>{chapter.title}</h1>
        <p className={styles.lede}>{chapter.blurb}</p>
      </header>
      <div className={contentStyles.prose}>
        <Suspense fallback={<p className={styles.loading}>Loading the chapter…</p>}>
          {/* Not created during render: every lazy component is made once, at module level, in lazyContent. */}
          {/* eslint-disable-next-line react-hooks/static-components */}
          <Content components={mdxComponents} />
          <ScrollToSection chapter={chapter.slug} section={section} />
          {/* Inside Suspense, so the footer can't be "seen" (and the chapter marked read) before the text loads. */}
          <ChapterFooter chapter={chapter} />
        </Suspense>
      </div>
    </article>
  );
}

/** Rendered after the chapter content, so the section heading exists when this runs. */
function ScrollToSection({ chapter, section }: { chapter: string; section: string | null }) {
  const first = useRef(true);
  useEffect(() => {
    const behavior = first.current ? 'auto' : 'smooth';
    first.current = false;
    if (!section || !scrollToSection(section, behavior)) window.scrollTo({ top: 0 });
  }, [chapter, section]);
  return null;
}

function ChapterFooter({ chapter }: { chapter: ChapterInfo }) {
  const ref = useRef<HTMLElement>(null);
  const next = CHAPTERS.find((c) => c.number === chapter.number + 1);

  // Reaching the end of a chapter counts as having read it.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) markChapterRead(chapter.slug);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [chapter.slug]);

  return (
    <footer ref={ref} className={styles.chapterFooter}>
      {next ? (
        <a href={href(next.slug)} className={styles.nextLink}>
          <span className={styles.nextLabel}>Next: Chapter {next.number}</span>
          <span className={styles.nextTitle}>{next.title} →</span>
          <span className={styles.nextBlurb}>{next.load ? next.blurb : 'Coming soon.'}</span>
        </a>
      ) : (
        <a href={href('')} className={styles.nextLink}>
          <span className={styles.nextLabel}>The end</span>
          <span className={styles.nextTitle}>Back to the start →</span>
        </a>
      )}
    </footer>
  );
}
