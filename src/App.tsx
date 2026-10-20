import { useEffect } from 'react';
import { findChapter } from './site/chapters';
import { ErrorBoundary } from './site/ErrorBoundary';
import { Layout } from './site/Layout';
import { About } from './site/pages/About';
import { ChapterPage } from './site/pages/ChapterPage';
import { ComingSoon, NotFound } from './site/pages/ComingSoon';
import { Landing } from './site/pages/Landing';
import { useRoute } from './site/router';

const SITE = 'From Black Box to Rulebook';

export function App() {
  const { page, section } = useRoute();
  const chapter = findChapter(page);

  let content;
  let title: string;
  if (page === '') {
    content = <Landing />;
    title = `${SITE}: rules from machine-learning models`;
  } else if (chapter) {
    content = <ChapterPage key={chapter.slug} chapter={chapter} section={section} />;
    title = `${chapter.title} · ${SITE}`;
  } else if (page === 'about') {
    content = <About />;
    title = `About · ${SITE}`;
  } else if (page === 'lab') {
    content = (
      <ComingSoon
        title="The Lab"
        blurb="Pick a dataset, a black-box model and an extraction method, and compare the rules you get."
      />
    );
    title = `The Lab · ${SITE}`;
  } else {
    content = <NotFound />;
    title = `Not found · ${SITE}`;
  }

  useEffect(() => {
    document.title = title;
  }, [title]);

  // New page: start at the top (chapters handle their own #section scrolling) and
  // move keyboard / screen-reader focus to the new content.
  useEffect(() => {
    if (!chapter) window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [page, chapter]);

  return (
    <Layout>
      <ErrorBoundary key={page} what="this page">
        {content}
      </ErrorBoundary>
    </Layout>
  );
}
