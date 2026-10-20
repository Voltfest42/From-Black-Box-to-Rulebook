import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests against the production build (vite preview), so they
 * check exactly what gets deployed. Run with: npm run e2e
 * To test the live site instead: BASE_URL=<the site URL> npm run e2e
 */
const liveUrl = process.env.BASE_URL;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: liveUrl ?? 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: liveUrl
    ? undefined
    : {
        command: 'npm run build && npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
