import { PAPER_TITLES, TIMELINE } from '../../content/timeline';
import contentStyles from '../content/content.module.css';
import { href } from '../router';
import styles from './pages.module.css';

const SIMPLIFICATIONS: { what: string; detail: string }[] = [
  {
    what: 'Neural networks, decision trees, random forests, the lasso',
    detail: 'Standard textbook versions, written from scratch: small networks trained with Adam, Gini trees grown best-first, forests of bootstrapped trees, and an L1-penalised logistic model fitted by proximal gradient descent.',
  },
  {
    what: 'The robots and the guard',
    detail:
      "The robots are the 432 robots of the 1991 MONK's problems, with the original hidden rules and training-set sizes; the training robots themselves are this site's own random draw. The stealth-game guard and its playtest logs are made up for this site, so that the true rule is known.",
  },
  {
    what: 'Reading rules off weights (Chapter 2)',
    detail:
      'An exact subset search for single neurons; M-of-N follows Towell and Shavlik’s grouping and averaging but not their final retraining. Whole-network extraction checks every rule exactly over all 432 robots, which only works because the robots are so few.',
  },
  {
    what: 'State machines from a recurrent network (Chapter 2)',
    detail: 'A real recurrent network trained in your browser, then Omlin and Giles-style clustering of its hidden states (with k-means) and standard minimisation. L* (Weiss et al., 2018) is described, not run.',
  },
  {
    what: 'TREPAN (Chapter 3)',
    detail:
      'The paper’s oracle queries, best-first growth, gain ratio, stopping test and m-of-n hill climbing, with 200–300 cases per split instead of 1,000 so that it runs quickly.',
  },
  {
    what: 'VIPER (Chapter 3)',
    detail:
      'The paper’s weighted imitation rounds. Our agent is a small policy network without a Q-function, so how much a choice matters is estimated by letting the network play on after each action. The agent was trained ahead of time by a script in the repository, with the cross-entropy method.',
  },
  {
    what: 'RuleFit and SIRUS (Chapter 3)',
    detail: 'RuleFit’s rules come from an ordinary random forest. SIRUS keeps rules found in at least a share of 1,000 quantile-split trees, drops redundant ones and averages the rest.',
  },
  {
    what: 'LIME, Anchors and LORE (Chapter 4)',
    detail:
      'LIME’s weighted linear fit. Anchors with the paper’s beam search, KL-LUCB bandit and settings. LORE with a simplified genetic algorithm; every counterfactual is double-checked against the network.',
  },
  {
    what: 'CORELS (Chapter 5)',
    detail: 'Branch and bound with the paper’s objective and four of its bounds, enough to certify optimality here, not all of its speed-ups. It runs in a background thread.',
  },
  {
    what: 'The rule network (Chapter 5)',
    detail: 'A small AND/OR network in the spirit of DR-Net and RRL, not a reimplementation of either.',
  },
  {
    what: 'The clock network (Chapter 6)',
    detail:
      'The summed-embedding model of Liu et al. (2022), not the transformer of Nanda et al. (2023), trained on addition modulo 23 instead of 113 so that it groks in seconds. The circles are drawn by projecting each embedding onto the cosine and sine directions of one frequency.',
  },
  {
    what: 'Giant models (Chapter 6)',
    detail: 'Described, not run: no language model runs in this site. Figure 6.2 is a diagram, with an illustrative example rule.',
  },
];

export function About() {
  const sources = TIMELINE.filter((e) => e.link).sort((a, b) => a.year.localeCompare(b.year));
  return (
    <article className={styles.page}>
      <header className={styles.chapterHeader}>
        <p className={styles.kicker}>About</p>
        <h1>About this site</h1>
        <p className={styles.lede}>What it is, how the demos work, and how far to trust them.</p>
      </header>
      <div className={contentStyles.prose}>
        <p>
          This site is an interactive introduction to <b>rule extraction</b>: the techniques, developed since the late 1980s, for turning what a
          machine-learning model has learned into rules people can read. It is written for readers who know roughly what machine learning is but
          don't follow explainability research.
        </p>

        <h2>The demos run real code</h2>
        <p>
          Every figure trains real models and runs real extraction algorithms, in your browser. Nothing is a pre-recorded animation, and nothing is
          sent to a server. Each method reports its steps as it runs, so the figures can step backwards as well as forwards. The only exceptions are
          Figure 6.2, a diagram, and the cart-pole agent of Figure 3.4, which was trained ahead of time by a script in the repository (the extraction
          from it runs live).
        </p>

        <h2>How it is tested</h2>
        <p>
          Every model and algorithm is checked automatically: neural-network gradients against finite differences, tree splits against brute force,
          the neuron subset search against every possible input of hundreds of random neurons, and CORELS, Anchors and LORE against the guarantees
          their papers make. Where the robots allow it, results are checked exactly on all 432 of them, for example the precision of every anchor.
          End-to-end tests open every page, use every figure, and run accessibility checks (WCAG 2.1 AA) in light and dark mode and on a phone.
        </p>

        <h2>What is simplified</h2>
        <table>
          <thead>
            <tr>
              <th scope="col">Part</th>
              <th scope="col">How faithful it is</th>
            </tr>
          </thead>
          <tbody>
            {SIMPLIFICATIONS.map((s) => (
              <tr key={s.what}>
                <td>
                  <b>{s.what}</b>
                </td>
                <td>{s.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>Sources</h2>
        <p>Research papers and reports, in date order (most link to a free version):</p>
        <ul>
          {sources.map((e) => (
            <li key={e.link}>
              {e.who}: <a href={e.link} target="_blank" rel="noreferrer">{PAPER_TITLES[e.link!] ?? e.title}</a> ({e.venue}, {e.year}
              {e.preprint ? ', preprint' : ''})
            </li>
          ))}
        </ul>
        <p>Also cited:</p>
        <ul>
          <li>G. F. Cooper and colleagues, An evaluation of machine-learning methods for predicting pneumonia mortality, Artificial Intelligence in Medicine 9(2), 1997.</li>
          <li>Leo Breiman, Statistical Modeling: The Two Cultures, Statistical Science 16(3), 2001, which named the Rashomon effect.</li>
          <li>Pang Wei Koh and colleagues, Concept Bottleneck Models, ICML 2020.</li>
          <li>
            The EU AI Act, <a href="https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-86" target="_blank" rel="noreferrer">Article 86</a>, and the 2026
            Digital Omnibus amendment that moved most high-risk obligations to December 2027.
          </li>
        </ul>
        <p>
          The research notes behind the story, with every claim's source, are in the project's <code>docs/research.md</code>.
        </p>

        <h2>Built with</h2>
        <p>
          TypeScript, React and Vite, with chapter text in MDX. Every model and algorithm is written from scratch for this site. It is hosted as a
          static site on Amazon S3 and CloudFront. There's no server, no tracking and no cookies. The only thing stored is which chapters you've
          finished, in your own browser. Try the methods yourself in <a href={href('lab')}>the Lab</a>.
        </p>
      </div>
    </article>
  );
}
