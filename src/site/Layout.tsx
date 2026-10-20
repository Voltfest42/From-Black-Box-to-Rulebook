import { useEffect, useState, type ReactNode } from 'react';
import { CHAPTERS, findChapter, sectionId } from './chapters';
import { useReadChapters } from './progress';
import { href, scrollToSection, useRoute } from './router';
import styles from './Layout.module.css';

export function Layout({ children }: { children: ReactNode }) {
  const route = useRoute();
  const read = useReadChapters();
  const [menuOpen, setMenuOpen] = useState(false);
  const chapter = findChapter(route.page);
  const activeSection = useActiveSection(chapter?.sections.map(sectionId) ?? []);

  // Close the mobile menu whenever the reader navigates.
  const routeKey = href(route.page, route.section);
  const [lastRoute, setLastRoute] = useState(routeKey);
  if (lastRoute !== routeKey) {
    setLastRoute(routeKey);
    setMenuOpen(false);
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main" onClick={(e) => (e.preventDefault(), document.getElementById('main')?.focus())}>
        Skip to content
      </a>

      <header className={styles.topbar}>
        <a href={href('')} className={styles.brand}>
          From Black Box to Rulebook
        </a>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="site-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Close' : 'Contents'}
        </button>
      </header>

      <nav id="site-nav" className={`${styles.sidebar} ${menuOpen ? styles.open : ''}`} aria-label="Contents">
        <a href={href('')} className={`${styles.brand} ${styles.sidebarBrand}`}>
          From Black Box to Rulebook
        </a>
        <p className={styles.tagline}>Rules from machine-learning models, 1988–2026</p>

        <ol className={styles.chapterList}>
          {CHAPTERS.map((c) => {
            const active = c.slug === route.page;
            const done = read.includes(c.slug);
            return (
              <li key={c.slug}>
                <a href={href(c.slug)} className={`${styles.chapterLink} ${active ? styles.active : ''}`} aria-current={active ? 'page' : undefined}>
                  <span className={`${styles.badge} ${done ? styles.badgeDone : ''}`} aria-hidden="true">
                    {done ? '✓' : c.number}
                  </span>
                  <span>
                    {c.title}
                    {!c.load && <span className={styles.soon}>soon</span>}
                    {done && <span className="visually-hidden"> (read)</span>}
                  </span>
                </a>
                {active && c.sections.length > 0 && (
                  <ol className={styles.sectionList}>
                    {c.sections.map((title) => {
                      const id = sectionId(title);
                      return (
                        <li key={id}>
                          <a
                            href={href(c.slug, id)}
                            className={id === activeSection ? styles.activeSection : undefined}
                            aria-current={id === activeSection ? 'location' : undefined}
                            onClick={() => {
                              // Same URL as now: no hashchange will fire, so scroll directly.
                              if (window.location.hash === href(c.slug, id)) scrollToSection(id);
                            }}
                          >
                            {title}
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </li>
            );
          })}
        </ol>

        <ul className={styles.extraList}>
          <li>
            <a href={href('lab')} className={route.page === 'lab' ? styles.active : undefined}>
              The Lab
            </a>
          </li>
          <li>
            <a href={href('about')} className={route.page === 'about' ? styles.active : undefined}>
              About this site
            </a>
          </li>
        </ul>
      </nav>

      <main id="main" className={styles.main} tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

/** Headings above this line (px from the top of the window) count as "scrolled past". */
const ACTIVE_LINE = 140;

/**
 * The section being read, for highlighting in the sidebar: normally the last
 * heading scrolled past the line near the top of the window. A short final
 * section can never reach that line, because the page runs out first, so once
 * the page is scrolled to the very bottom, the last heading visible on screen wins.
 */
function useActiveSection(ids: readonly string[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const key = ids.join('|');

  useEffect(() => {
    const sectionIds = key ? key.split('|') : [];
    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      const line = atBottom ? window.innerHeight : ACTIVE_LINE;
      let current: string | null = null;
      for (const id of sectionIds) {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top < line) current = id;
      }
      setActive(current);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key]);

  return active;
}
