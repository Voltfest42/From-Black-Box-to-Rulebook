import mdx from '@mdx-js/rollup';
import react from '@vitejs/plugin-react';
import remarkGfm from 'remark-gfm';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // MDX must run before the React plugin so chapters get Fast Refresh too.
    // remark-gfm adds GitHub-style Markdown: tables, strikethrough, autolinks.
    { enforce: 'pre', ...mdx({ remarkPlugins: [remarkGfm] }) },
    react({ include: /\.(mdx|js|jsx|ts|tsx)$/ }),
  ],
  build: {
    target: 'es2022',
  },
  server: {
    // The CDK app's build output holds locked zip files on Windows, which crashes the watcher.
    watch: { ignored: ['**/infra/**', '**/docs/**'] },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
