import { expect, test, type Page } from '@playwright/test';
import { accessibilityViolations, expectNoBrokenFigures, watchErrors } from './helpers';

const result = (page: Page) => page.locator('[aria-busy]');

async function settled(page: Page) {
  await expect(result(page)).toHaveAttribute('aria-busy', 'false', { timeout: 20_000 });
}

async function fidelity(page: Page): Promise<number> {
  const text = await result(page).locator('dd b').first().textContent();
  return Number(text!.replace('%', ''));
}

test('the Lab extracts rules from every black box, with no errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/lab');
  await expect(page.getByRole('heading', { level: 1, name: 'Try any method on any model' })).toBeVisible();
  await settled(page);
  for (const model of ['Neural network', 'Random forest (100 trees)', 'Nearest neighbours']) {
    await page.getByRole('button', { name: model }).click();
    await settled(page);
    expect(await fidelity(page), model).toBeGreaterThan(80);
  }
  await expect(page.getByRole('group', { name: 'Extracted rules' })).toContainText('THEN');
  await expectNoBrokenFigures(page);
  expect(await accessibilityViolations(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('RuleFit shows weighted rules within the budget', async ({ page }) => {
  await page.goto('/#/lab');
  await page.getByLabel('Data', { exact: true }).selectOption('spiral');
  await page.getByLabel('Extraction method').selectOption('rulefit');
  await settled(page);
  const rules = page.getByRole('list', { name: 'Weighted rules' }).locator('li');
  const count = await rules.count();
  expect(count).toBeGreaterThan(0);
  expect(count).toBeLessThanOrEqual(8);
  await expect(rules.first()).toContainText(/[+−]\d/);
});

test('CORELS finds the hidden rule of Puzzle 1 in the network, and certifies it', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/lab');
  await page.getByLabel('Data', { exact: true }).selectOption('monk1');
  await page.getByLabel('Extraction method').selectOption('corels');
  await settled(page);
  await expect(result(page)).toContainText('Certified');
  await expect(page.getByRole('group', { name: 'Extracted rules' })).toContainText('jacket is red');
  expect(await fidelity(page)).toBe(100);
  expect(errors).toEqual([]);
});

test('local methods explain the case you click', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/#/lab');
  await page.getByLabel('Extraction method').selectOption('lore');
  await settled(page);
  await expect(page.getByLabel('Most leaves or rules allowed')).toHaveCount(0);
  const map = result(page).locator('svg').first();
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * 0.2, y: box.height * 0.3 } });
  await settled(page);
  await expect(result(page)).toContainText('spotted because');
  await expect(result(page)).toContainText('✓');

  await page.getByLabel('Data', { exact: true }).selectOption('monk1');
  await page.getByLabel('Extraction method').selectOption('anchors');
  await settled(page);
  await expect(result(page)).toContainText(/Precision about \d+%/);
  expect(errors).toEqual([]);
});

test.describe('on a phone, in dark mode', () => {
  test.use({ viewport: { width: 375, height: 812 }, colorScheme: 'dark' });

  test('the Lab fits the screen and passes the accessibility checks', async ({ page }) => {
    await page.goto('/#/lab');
    await page.getByLabel('Data', { exact: true }).selectOption('monk2');
    await settled(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    expect(await accessibilityViolations(page)).toEqual([]);
  });
});
