import Intro from '../../content/intro.mdx';
import { Legend } from '../../viz/Figure';
import { CHAPTERS } from '../chapters';
import { mdxComponents } from '../content/mdxComponents';
import { useReadChapters } from '../progress';
import { href } from '../router';
import contentStyles from '../content/content.module.css';
import styles from './pages.module.css';

export function Landing() {
  const read = useReadChapters();
  const written = CHAPTERS.filter((c) => c.load);
  const firstUnread = written.find((c) => !read.includes(c.slug)) ?? written[0];

  return (
    <article className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>An interactive story</p>
        <h1 className={styles.heroTitle}>From Black Box to Rulebook</h1>
        <p className={styles.lede}>How researchers pull readable rules out of machine-learning models, explained with live demos.</p>
      </header>

      <div className={contentStyles.prose}>
        <Intro components={mdxComponents} />
      </div>

      {firstUnread && (
        <p>
          <a href={href(firstUnread.slug)} className={styles.cta}>
            {read.length === 0 ? 'Start reading' : 'Continue'}: Chapter {firstUnread.number} →
          </a>
        </p>
      )}

      <h2 className={styles.sectionTitle}>The chapters</h2>
      <ol className={styles.cards}>
        {CHAPTERS.map((c) => {
          const body = (
            <>
              <span className={styles.cardNumber}>
                Chapter {c.number} · {c.era}
                {read.includes(c.slug) && <span className={styles.readTag}>✓ read</span>}
              </span>
              <span className={styles.cardTitle}>{c.title}</span>
              <span className={styles.cardBlurb}>{c.blurb}</span>
              {!c.load && <span className={styles.soonTag}>Coming soon</span>}
            </>
          );
          return (
            <li key={c.slug}>
              {c.load ? (
                <a href={href(c.slug)} className={styles.card}>
                  {body}
                </a>
              ) : (
                <div className={`${styles.card} ${styles.cardDisabled}`}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>

      <h2 className={styles.sectionTitle}>How to use the demos</h2>
      <div className={contentStyles.prose}>
        <p>
          Every chapter has live figures that train real models and run the real extraction methods, right in your
          browser. Step-by-step figures have <b>▶ Play</b> and step buttons, and the <kbd>←</kbd> <kbd>→</kbd> keys work
          too. A caption under each figure says what just happened. Dotted-underlined words have a short definition:
          hover over or tap them.
        </p>
        <p>
          Want to experiment? The <a href={href('lab')}>Lab</a> lets you pick any dataset, any model and any extraction
          method, and compare the rules you get.
        </p>
        <p>The colours mean the same thing in every figure:</p>
        <Legend items={['yes', 'no', 'modelYes', 'modelNo', 'rule', 'disagree']} />
      </div>
    </article>
  );
}
