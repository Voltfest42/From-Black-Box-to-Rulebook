import { expect, test } from '@playwright/test';
import { accessibilityViolations, expectNoBrokenFigures, watchErrors } from './helpers';

const figure = (page: import('@playwright/test').Page, n: string) => page.locator(`figure[aria-labelledby="figure-${n}"]`);

test('Chapter 1 shows all four figures, with no errors or accessibility problems', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/rules');
  await expect(page.getByRole('heading', { level: 1, name: 'Rules, and why we want them' })).toBeVisible();
  for (const n of ['1.1', '1.2', '1.3', '1.4']) await expect(figure(page, n)).toBeVisible();
  await expectNoBrokenFigures(page);
  expect(await accessibilityViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('guess the rule: conditions cover robots, and the hidden rule labels all 432 correctly', async ({ page }) => {
  await page.goto('/#/rules/what-a-rule-is');
  const fig = figure(page, '1.1');
  await fig.getByRole('button', { name: 'jacket is red' }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('Your rules call 108 robots friendly. 0 of those');
  await expect(fig.getByRole('tab', { name: /Rule 1/ })).toContainText('108 robots, 100% right');
  // A second click turns "is red" into "is not red".
  await fig.getByRole('button', { name: 'jacket is red' }).click();
  await expect(fig.getByRole('button', { name: 'jacket is not red' })).toBeVisible();
  await fig.getByRole('button', { name: 'Reveal the hidden rule' }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('Every one of the 432 robots is labelled correctly');
  // The hard puzzle needs 15 rules.
  await fig.getByRole('button', { name: 'Puzzle 3 (hard)' }).click();
  await fig.getByRole('button', { name: 'Reveal the hidden rule' }).click();
  await expect(fig.getByRole('tab')).toHaveCount(15);
});

test('train the black box: the network learns Puzzle 1 perfectly, and the weights can be shown', async ({ page }) => {
  await page.goto('/#/rules/a-black-box-learns-the-robots');
  const fig = figure(page, '1.2');
  await expect(fig.getByText('Round 0 / 250')).toBeVisible();
  await fig.getByRole('button', { name: /Train the network/ }).click();
  await fig.getByRole('button', { name: 'Skip to the end' }).click();
  await expect(fig.getByText('Round 250 / 250')).toBeVisible();
  await expect(fig.getByText('432 / 432')).toBeVisible();
  await fig.getByLabel(/Show me the numbers/).check();
  await expect(fig.getByRole('table')).toContainText('jacket = red');
});

test('grading: the exact copy of the network is 100% faithful but not 100% accurate', async ({ page }) => {
  await page.goto('/#/rules/grading-a-rule');
  const fig = figure(page, '1.4');
  await fig.getByRole('button', { name: /An exact copy of the network/ }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('100% faithful');
  await expect(fig.getByText(/mostly wrong about the real robots/)).toBeVisible();
  await fig.getByRole('button', { name: /The designer’s rule/ }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('100% accuracy');
});

test('Chapter 1 works on a phone without scrolling sideways @phone', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/rules');
  await expect(figure(page, '1.4')).toBeAttached();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expectNoBrokenFigures(page);
  expect(errors).toEqual([]);
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('Chapter 1 passes the accessibility checks in dark mode', async ({ page }) => {
    await page.goto('/#/rules');
    await expect(figure(page, '1.1')).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
  });
});
