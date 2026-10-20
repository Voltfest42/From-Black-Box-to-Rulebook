import { expect, test } from '@playwright/test';
import { accessibilityViolations, expectNoBrokenFigures, figureByNumber, watchErrors } from './helpers';

test('Chapter 4 shows all three figures, with no errors or accessibility problems', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/one-decision');
  await expect(page.getByRole('heading', { level: 1, name: 'Explaining one decision' })).toBeVisible();
  for (const n of ['4.1', '4.2', '4.3']) await expect(figureByNumber(page, n)).toBeVisible();
  await expectNoBrokenFigures(page);
  expect(await accessibilityViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('LIME: the line is right near the case and wrong far away', async ({ page }) => {
  await page.goto('/#/one-decision/one-decision-at-a-time');
  const fig = figureByNumber(page, '4.1');
  await expect(fig.locator('p[aria-live]')).toContainText('Inside the circle the line agrees with the network on');
  // Pick another position by clicking the map: the explanation changes.
  const before = await fig.locator('p[aria-live]').textContent();
  const map = fig.locator('svg[role="img"]').first();
  const box = (await map.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.2);
  await expect(fig.locator('p[aria-live]')).not.toHaveText(before!);
});

test('Anchors: a red-jacket robot is anchored by its jacket alone, checked on all 432 robots', async ({ page }) => {
  await page.goto('/#/one-decision/anchors-a-rule-that-pins-the-prediction');
  const fig = figureByNumber(page, '4.2');
  await fig.getByRole('button', { name: 'Jump to the end' }).click();
  await expect(fig.getByText('Precision, checked on all 432 robots')).toBeVisible();
  await expect(fig.locator('p[aria-live]')).toContainText('The anchor with the widest coverage wins');
  await fig.getByRole('button', { name: 'Pick an unfriendly one' }).click();
  await fig.getByRole('button', { name: 'Jump to the end' }).click();
  await expect(fig.getByText('…whatever its other traits.')).toBeVisible();
  await fig.getByRole('button', { name: 'Puzzle 3 (hard)' }).click();
  await fig.getByRole('button', { name: 'Jump to the end' }).click();
  await expect(fig.getByText('Coverage', { exact: true })).toBeVisible();
});

test('LORE: a factual rule and at least one counterfactual', async ({ page }) => {
  await page.goto('/#/one-decision/what-would-change-the-decision');
  const fig = figureByNumber(page, '4.3');
  await expect(fig.locator('p[aria-live]')).toContainText('Factual rule:');
  await expect(fig.getByText(/you’d have been/).first()).toBeVisible();
});

test('Chapter 4 works on a phone without scrolling sideways @phone', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/one-decision');
  await expect(figureByNumber(page, '4.3')).toBeAttached();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('Chapter 4 passes the accessibility checks in dark mode', async ({ page }) => {
    await page.goto('/#/one-decision');
    await expect(figureByNumber(page, '4.1')).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
  });
});
