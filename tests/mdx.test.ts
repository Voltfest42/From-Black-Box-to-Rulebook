import { readdirSync, readFileSync } from 'node:fs';
import { compile } from '@mdx-js/mdx';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';

const dir = new URL('../src/content/', import.meta.url);
const chapters = readdirSync(dir).filter((f) => f.endsWith('.mdx'));

describe('chapter MDX', () => {
  it.each(chapters)('%s compiles, and its Markdown tables become real tables', async (file) => {
    const source = readFileSync(new URL(file, dir), 'utf8');
    // Same plugins as vite.config.ts.
    const output = String(await compile(source, { remarkPlugins: [remarkGfm] }));
    // A Markdown table has a separator row like |---|---|.
    const hasTable = source.split('\n').some((line) => /^\|[\s:|-]+\|$/.test(line.trim()));
    if (hasTable) expect(output).toContain('_components.table');
    expect(output.length).toBeGreaterThan(0);
  });
});
