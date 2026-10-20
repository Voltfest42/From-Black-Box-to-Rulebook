import { expect, test } from '@playwright/test';
import { CHAPTERS } from '../src/site/chapters';
import { accessibilityViolations, expectNoBrokenFigures, watchErrors } from './helpers';

test('landing page shows the story and every chapter @phone', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'From Black Box to Rulebook' })).toBeVisible();
  await expect(page.getByText('IF the patient has asthma THEN their risk is lower.')).toBeVisible();
  for (const c of CHAPTERS) await expect(page.getByText(c.title, { exact: true }).first()).toBeVisible();
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

test('unknown pages show a friendly not-found page', async ({ page }) => {
  await page.goto('/#/no-such-page');
  await expect(page.getByRole('heading', { name: "There's no page here" })).toBeVisible();
});
