import { describe, expect, it } from 'vitest';
import { PAPER_TITLES, TIMELINE } from '../src/content/timeline';

describe('timeline', () => {
  it('has a real paper title for every linked entry, and no orphan titles', () => {
    const links = TIMELINE.flatMap((e) => (e.link ? [e.link] : []));
    for (const link of links) expect(PAPER_TITLES[link], link).toBeTruthy();
    for (const link of Object.keys(PAPER_TITLES)) expect(links).toContain(link);
  });
});
