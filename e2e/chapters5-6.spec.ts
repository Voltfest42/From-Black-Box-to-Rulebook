import { expect, test } from '@playwright/test';
import { accessibilityViolations, expectNoBrokenFigures, figureByNumber, watchErrors } from './helpers';

test('Chapter 5 shows its figures, with no errors or accessibility problems', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/rules-by-design');
  await expect(page.getByRole('heading', { level: 1, name: 'Building the box from rules' })).toBeVisible();
  for (const n of ['5.1', '5.2', '5.3']) await expect(figureByNumber(page, n)).toBeVisible();
  await expect(page.getByText('IF age 18–20 AND male THEN predict re-arrest')).toBeVisible();
  await expectNoBrokenFigures(page);
  expect(await accessibilityViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('CORELS proves the hidden rule optimal, in a background thread', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/rules-by-design/searching-for-the-best-rule-list');
  const fig = figureByNumber(page, '5.1');
  await fig.getByRole('button', { name: /Search/ }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('certified optimal', { timeout: 30_000 });
  await expect(fig.locator('p[aria-live]')).toContainText('432 of all 432 robots right');
  await expect(fig.getByText('holds sword', { exact: true })).toBeVisible();
  await expect(fig.getByText('jacket is green', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the Rashomon set grows with the tolerance', async ({ page }) => {
  await page.goto('/#/rules-by-design/many-equally-good-answers');
  const fig = figureByNumber(page, '5.2');
  const count = async () => Number((await fig.locator('p[aria-live]').textContent())!.match(/^([\d,]+) of/)![1].replace(/,/g, ''));
  await fig.getByRole('button', { name: '1 points' }).click();
  const small = await count();
  await fig.getByRole('button', { name: '5 points' }).click();
  expect(await count()).toBeGreaterThan(small);
  await expect(fig.getByRole('region')).toHaveCount(4);
});

test('the rule network learns the hidden rule of Puzzle 1', async ({ page }) => {
  await page.goto('/#/rules-by-design/neural-networks-that-learn-rules');
  const fig = figureByNumber(page, '5.3');
  await fig.getByRole('button', { name: /Train/ }).click();
  await fig.getByRole('button', { name: 'Skip to the end' }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('exactly the hidden rule');
});

test('Chapter 6: the CLIPPER loop steps, and the timeline filters by strategy', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/giant-models');
  await expect(page.getByRole('heading', { level: 1, name: 'Giant models, and what it all means' })).toBeVisible();
  const loop = figureByNumber(page, '6.1');
  await loop.getByRole('button', { name: 'Jump to the end' }).click();
  await expect(loop.locator('p[aria-live]')).toContainText('needs no language model');
  const timeline = figureByNumber(page, '6.2');
  const all = await timeline.locator('ol > li').count();
  await timeline.getByRole('button', { name: 'Giant models' }).click();
  expect(await timeline.locator('ol > li').count()).toBeLessThan(all);
  await expectNoBrokenFigures(page);
  expect(await accessibilityViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('the About page lists the sources', async ({ page }) => {
  await page.goto('/#/about');
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  expect(await page.locator('article a[href^="https://arxiv.org"]').count()).toBeGreaterThan(20);
  expect(await accessibilityViolations(page)).toEqual([]);
});

test('Chapters 5 and 6 work on a phone without scrolling sideways @phone', async ({ page }) => {
  for (const slug of ['rules-by-design', 'giant-models']) {
    await page.goto(`/#/${slug}`);
    await expect(page.locator('figure').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, slug).toBeLessThanOrEqual(0);
  }
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('Chapters 5, 6 and About pass the accessibility checks in dark mode', async ({ page }) => {
    for (const path of ['/#/rules-by-design', '/#/giant-models', '/#/about']) {
      await page.goto(path);
      await expect(page.locator('main h1')).toBeVisible();
      expect(await accessibilityViolations(page), path).toEqual([]);
    }
  });
});
