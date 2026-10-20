import { expect, test } from '@playwright/test';
import { CHAPTERS } from '../src/site/chapters';
import { accessibilityViolations, expectNoBrokenFigures, watchErrors } from './helpers';

test('landing page shows the story and every chapter @phone', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'From Black Box to Rulebook' })).toBeVisible();
  await expect(page.getByText('IF the patient has asthma THEN their risk is lower.')).toBeVisible();
  for (const c of CHAPTERS) await expect(page.locator('main').getByText(c.title, { exact: true })).toBeVisible();
  expect(await accessibilityViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('every chapter page opens without errors', async ({ page }) => {
  const errors = watchErrors(page);
  for (const c of CHAPTERS) {
    await page.goto(`/#/${c.slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(c.title);
    await expectNoBrokenFigures(page);
  }
  expect(errors).toEqual([]);
});

test('the sidebar lists the sections of the open chapter', async ({ page }) => {
  await page.goto(`/#/${CHAPTERS[0].slug}`);
  const sidebar = page.getByRole('navigation', { name: 'Contents' });
  for (const section of CHAPTERS[0].sections) await expect(sidebar.getByRole('link', { name: section })).toBeAttached();
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('the landing page passes the accessibility checks in dark mode too', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main h1')).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
  });
});

test.describe('at 375 pixels wide', () => {
  // A desktop browser at phone width: unlike phone emulation, it can't zoom out to hide a page that is too wide.
  test.use({ viewport: { width: 375, height: 812 } });

  test('no page scrolls sideways', async ({ page }) => {
    for (const path of ['', ...CHAPTERS.map((c) => c.slug), 'lab', 'about']) {
      await page.goto(`/#/${path}`);
      await expect(page.locator('main h1')).toBeVisible();
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, path || 'landing').toBeLessThanOrEqual(0);
    }
  });
});

test('unknown pages show a friendly not-found page', async ({ page }) => {
  await page.goto('/#/no-such-page');
  await expect(page.getByRole('heading', { name: "There's no page here" })).toBeVisible();
});
