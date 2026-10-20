import { expect, test } from '@playwright/test';
import { accessibilityViolations, expectNoBrokenFigures, figureByNumber, watchErrors } from './helpers';

test('Chapter 2 shows all four figures, with no errors or accessibility problems', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/opening-the-box');
  await expect(page.getByRole('heading', { level: 1, name: 'Opening the box' })).toBeVisible();
  for (const n of ['2.1', '2.2', '2.3', '2.4']) await expect(figureByNumber(page, n)).toBeVisible();
  await expectNoBrokenFigures(page);
  expect(await accessibilityViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('read a neuron: the search finds the rules, and M-of-N says it in one', async ({ page }) => {
  await page.goto('/#/opening-the-box/a-neuron-is-a-weighted-vote');
  const fig = figureByNumber(page, '2.1');
  await fig.getByRole('button', { name: 'Jump to the end' }).click();
  await expect(fig.getByText('IF smiling AND has a tie THEN fire')).toBeVisible();
  await expect(fig.getByText('Groups tested: 7 · skipped: 1 · of 8 possible groups')).toBeVisible();
  await fig.getByLabel(/Show the M-of-N version/).check();
  await expect(fig.getByText(/at least 2 of \{smiling, has a tie, red jacket\}/)).toBeVisible();
  await fig.getByRole('button', { name: 'A veto' }).click();
  await fig.getByRole('button', { name: 'Jump to the end' }).click();
  await expect(fig.getByText('IF smiling AND not round head THEN fire')).toBeVisible();
});

test('extract a network: the first network gives back the hidden rule', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/opening-the-box/from-one-neuron-to-a-whole-network');
  const fig = figureByNumber(page, '2.2');
  await fig.getByRole('button', { name: 'Tidy' }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('4 rules, 100% faithful');
  await fig.getByRole('button', { name: 'Train a new network' }).click();
  await expect(fig.getByText('Network #2')).toBeVisible();
  await fig.getByRole('button', { name: 'Jump to the end' }).click();
  await expect(fig.locator('p[aria-live]')).toContainText('Tidied up');
  expect(errors).toEqual([]);
});

test('the wall: the slider counts groups of inputs', async ({ page }) => {
  await page.goto('/#/opening-the-box/the-wall-too-many-combinations');
  const fig = figureByNumber(page, '2.3');
  await fig.getByRole('slider', { name: 'Number of inputs' }).fill('57');
  await expect(fig.locator('p[role=status]')).toContainText('1.4 × 10¹⁷');
});

test('the combo detector: training gives the hand-written machine, and both fire on ↓ → P', async ({ page }) => {
  await page.goto('/#/opening-the-box/networks-with-memory-become-machines');
  const fig = figureByNumber(page, '2.4');
  await fig.getByRole('button', { name: /Train the network/ }).click();
  await fig.getByRole('button', { name: 'Skip to the end' }).click();
  await expect(fig.locator('p[aria-live]').last()).toContainText('exactly the one a game developer would write by hand');
  for (const key of ['Press down', 'Press forward', 'Press punch']) await fig.getByRole('button', { name: key }).click();
  await expect(fig.getByText('Machine: special move!')).toBeVisible();
  await expect(fig.getByText('Network: special move!')).toBeVisible();
  await fig.getByRole('slider', { name: 'Number of clusters' }).fill('1');
  await expect(fig.locator('p[aria-live]').last()).toContainText('it never fires at all');
});

test('Chapter 2 works on a phone without scrolling sideways @phone', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/opening-the-box');
  await expect(figureByNumber(page, '2.4')).toBeAttached();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('Chapter 2 passes the accessibility checks in dark mode', async ({ page }) => {
    await page.goto('/#/opening-the-box');
    await expect(figureByNumber(page, '2.1')).toBeVisible();
    expect(await accessibilityViolations(page)).toEqual([]);
  });
});
