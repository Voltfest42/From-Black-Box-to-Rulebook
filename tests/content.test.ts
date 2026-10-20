import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/site/chapters';
import { GLOSSARY } from '../src/site/glossary';
import { parseHash, slugify } from '../src/site/router';

describe('chapter registry', () => {
  it.each(CHAPTERS.filter((c) => c.load))('lists exactly the ## headings of chapter $number', (chapter) => {
    const source = readFileSync(new URL(`../src/content/chapter${chapter.number}.mdx`, import.meta.url), 'utf8');
    const headings = [...source.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
    expect(headings).toEqual(chapter.sections);
  });

  it('has unique slugs, and unique section ids within each chapter', () => {
    expect(new Set(CHAPTERS.map((c) => c.slug)).size).toBe(CHAPTERS.length);
    for (const chapter of CHAPTERS) {
      const ids = chapter.sections.map(slugify);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('numbers chapters 1, 2, 3, …', () => {
    expect(CHAPTERS.map((c) => c.number)).toEqual(CHAPTERS.map((_, i) => i + 1));
  });
});

describe('glossary', () => {
  it('only uses glossary ids that exist', () => {
    const ids = new Set(Object.keys(GLOSSARY));
    const files = ['intro', ...CHAPTERS.filter((c) => c.load).map((c) => `chapter${c.number}`)];
    for (const file of files) {
      const source = readFileSync(new URL(`../src/content/${file}.mdx`, import.meta.url), 'utf8');
      for (const match of source.matchAll(/<Term id="([^"]+)"/g)) expect(ids, `${file}: ${match[1]}`).toContain(match[1]);
    }
  });
});

describe('router', () => {
  it('parses page and section from the hash', () => {
    expect(parseHash('')).toEqual({ page: '', section: null });
    expect(parseHash('#/')).toEqual({ page: '', section: null });
    expect(parseHash('#/rules')).toEqual({ page: 'rules', section: null });
    expect(parseHash('#/rules/what-a-rule-is')).toEqual({ page: 'rules', section: 'what-a-rule-is' });
  });

  it('slugifies headings into URL-safe ids', () => {
    expect(slugify('What would change the decision?')).toBe('what-would-change-the-decision');
    expect(slugify('The wall: too many combinations')).toBe('the-wall-too-many-combinations');
  });
});
