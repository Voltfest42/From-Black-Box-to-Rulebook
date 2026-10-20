import contentStyles from '../content/content.module.css';
import { href } from '../router';
import styles from './pages.module.css';

export function About() {
  return (
    <article className={styles.page}>
      <header className={styles.chapterHeader}>
        <p className={styles.kicker}>About</p>
        <h1>About this site</h1>
        <p className={styles.lede}>What it is, how the demos work, and how far to trust them.</p>
      </header>
      <div className={contentStyles.prose}>
        <p>
          This site is an interactive introduction to <b>rule extraction</b>: the techniques, developed since the late
          1980s, for turning what a machine-learning model has learned into rules people can read. It is written for
          readers who know roughly what machine learning is but don't follow explainability research.
        </p>

        <h2>The demos run real code</h2>
        <p>
          Every figure trains real models and runs real extraction algorithms, in your browser. Nothing is a
          pre-recorded animation, and nothing is sent to a server. The <a href={href('lab')}>Lab</a> lets you combine
          any dataset, model and extraction method.
        </p>

        <h2>Built with</h2>
        <p>
          TypeScript, React and Vite, with chapter text in MDX. Every model and algorithm is written from scratch for
          this site. It is hosted as a static site on Amazon S3 and CloudFront. There's no server, no tracking and no
          cookies. The only thing stored is which chapters you've finished, in your own browser.
        </p>
      </div>
    </article>
  );
}
