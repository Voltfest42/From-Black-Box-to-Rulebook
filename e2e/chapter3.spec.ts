import { expect, test } from '@playwright/test';
import { accessibilityViolations, expectNoBrokenFigures, figureByNumber, watchErrors } from './helpers';

test('Chapter 3 shows all five figures, with no errors or accessibility problems', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/questioning-the-box');
  await expect(page.getByRole('heading', { level: 1, name: 'Questioning the box' })).toBeVisible();
  for (const n of ['3.1', '3.2', '3.3', '3.4', '3.5']) {
    const fig = figureByNumber(page, n);
    await fig.scrollIntoViewIfNeeded();
    await expect(fig).toBeVisible();
  }
  await expect(figureByNumber(page, '3.5').getByRole('button', { name: 'SIRUS (2021)' })).toBeVisible({ timeout: 20_000 });
  await expectNoBrokenFigures(page);
  expect(await accessibilityViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('TREPAN grows to its size limit, with and without made-up questions', async ({ page }) => {
  await page.goto('/#/questioning-the-box/the-network-as-an-oracle');
  const fig = figureByNumber(page, '3.1');
  await fig.getByRole('button', { name: 'Jump to the end' }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('Split 15');
  await expect(fig.locator('p[aria-live]')).toContainText('made-up positions');
  await fig.getByLabel('Ask the network about made-up positions').uncheck();
  await fig.getByRole('button', { name: 'Jump to the end' }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('only the');
});

test('m-of-n questions copy the "exactly two" network exactly', async ({ page }) => {
  await page.goto('/#/questioning-the-box/asking-better-questions');
  const column = figureByNumber(page, '3.2').getByRole('region', { name: 'With m-of-n splits' });
  await expect(column).toContainText('100%', { timeout: 20_000 });
});

test('the student beats the textbook when the logs are noisy', async ({ page }) => {
  await page.goto('/#/questioning-the-box/the-student-beats-the-textbook');
  const fig = figureByNumber(page, '3.3');
  await fig.getByRole('button', { name: '25% wrong' }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('the student wins', { timeout: 20_000 });
});

test('VIPER extracts a tree that can play cart-pole', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/questioning-the-box/turning-a-game-agent-into-a-rulebook');
  const fig = figureByNumber(page, '3.4');
  await fig.getByRole('button', { name: /Extract a tree with VIPER/ }).click();
  await expect(fig.locator('p[aria-live]').last()).toContainText('VIPER keeps the best tree', { timeout: 30_000 });
  await fig.getByRole('button', { name: /The tree \(/ }).click();
  await expect(fig.getByText(/steps…|Balanced|Fell after/).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('RuleFit and SIRUS both report their stability', async ({ page }) => {
  await page.goto('/#/questioning-the-box/forests-are-rules-already');
  const fig = figureByNumber(page, '3.5');
  await expect(fig.locator('p[aria-live]')).toContainText('The lasso keeps', { timeout: 20_000 });
  await fig.getByRole('button', { name: 'SIRUS (2021)' }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('SIRUS keeps');
  await expect(fig.getByText(/come back when the same method runs/)).toBeVisible();
});

test('Chapter 3 works on a phone without scrolling sideways @phone', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/questioning-the-box');
  for (const n of ['3.1', '3.2', '3.3', '3.4', '3.5']) await figureByNumber(page, n).scrollIntoViewIfNeeded();
  await expect(figureByNumber(page, '3.5').getByRole('button', { name: 'SIRUS (2021)' })).toBeVisible({ timeout: 20_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('Chapter 3 passes the accessibility checks in dark mode', async ({ page }) => {
    await page.goto('/#/questioning-the-box');
    for (const n of ['3.1', '3.2', '3.3', '3.4', '3.5']) await figureByNumber(page, n).scrollIntoViewIfNeeded();
    await expect(figureByNumber(page, '3.5').getByRole('button', { name: 'SIRUS (2021)' })).toBeVisible({ timeout: 20_000 });
    expect(await accessibilityViolations(page)).toEqual([]);
  });
});
