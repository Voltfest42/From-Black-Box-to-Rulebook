import type { MDXContent } from 'mdx/types';
import { slugify } from './router';

export interface ChapterInfo {
  slug: string;
  number: number;
  title: string;
  /** The years the chapter covers, shown under its title. */
  era: string;
  blurb: string;
  /** Section titles, exactly as written in the chapter's `##` headings. */
  sections: string[];
  /** Loads the chapter's MDX on demand; absent while the chapter isn't written yet. */
  load?: () => Promise<{ default: MDXContent }>;
}

export const CHAPTERS: readonly ChapterInfo[] = [
  {
    slug: 'rules',
    number: 1,
    title: 'Rules, and why we want them',
    era: 'The basics',
    blurb: 'What a rule is, how to grade one, and why a model you can read beats a slightly better one you can’t.',
    sections: ['The asthma rule', 'What a rule is', 'A black box learns the robots', 'Four ways to get the rule out', 'Grading a rule'],
    load: () => import('../content/chapter1.mdx'),
  },
  {
    slug: 'opening-the-box',
    number: 2,
    title: 'Opening the box',
    era: '1988–2021',
    blurb: 'Reading rules straight off a network’s weights, and turning a recurrent network into a state machine.',
    sections: [
      'A neuron is a weighted vote',
      'From one neuron to a whole network',
      'The wall: too many combinations',
      'Networks with memory become machines',
    ],
    load: () => import('../content/chapter2.mdx'),
  },
  {
    slug: 'questioning-the-box',
    number: 3,
    title: 'Questioning the box',
    era: '1994–2021',
    blurb: 'Treating the model as an oracle: grow a small model of its answers, from trees to game-playing agents.',
    sections: [
      'The network as an oracle',
      'Asking better questions',
      'The student beats the textbook',
      'Turning a game agent into a rulebook',
      'Forests are rules already',
      'The catch: a copy is not the original',
    ],
    load: () => import('../content/chapter3.mdx'),
  },
  {
    slug: 'one-decision',
    number: 4,
    title: 'Explaining one decision',
    era: '2016–2020',
    blurb: 'Short rules that hold near a single case, what would change the decision, and how explanations can be fooled.',
    sections: ['One decision at a time', 'Anchors: a rule that pins the prediction', 'What would change the decision?', 'Can explanations lie?'],
    load: () => import('../content/chapter4.mdx'),
  },
  {
    slug: 'rules-by-design',
    number: 5,
    title: 'Building the box from rules',
    era: '2015–2023',
    blurb: 'Skipping the black box: searching for the best rule list, the many equally good models, and networks that are rules.',
    sections: [
      'Stop explaining black boxes',
      'Searching for the best rule list',
      'Many equally good answers',
      'Neural networks that learn rules',
      'Where rules run out',
    ],
  },
  {
    slug: 'giant-models',
    number: 6,
    title: 'Giant models, and what it all means',
    era: '2023–2026',
    blurb: 'Reverse-engineering language models, language models that write rules, the law, and the whole story on one page.',
    sections: [
      'Billions of weights, no features',
      'Reverse-engineering the algorithm',
      'Language models as rule writers',
      'The law catches up',
      'The whole story on one page',
      'Which method when?',
      'Open questions and further reading',
    ],
  },
];

export function findChapter(slug: string): ChapterInfo | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}

export function sectionId(title: string): string {
  return slugify(title);
}
