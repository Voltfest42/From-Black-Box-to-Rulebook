import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Fails the test on any uncaught error or console error while the page is used. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

/** No error boundary may have fired ("Sorry, … hit an unexpected error"). */
export async function expectNoBrokenFigures(page: Page) {
  await expect(page.getByText(/hit an unexpected error/)).toHaveCount(0);
}

/** WCAG 2.1 A/AA checks with axe, reported as readable lines. */
export async function accessibilityViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}. ${v.nodes.length} element(s), e.g. ${v.nodes[0]?.target.join(' ')}`,
  );
}

/** Steps a figure to its end with the "Jump to the end" button, if it has one. */
export async function runFigureToEnd(page: Page, index: number) {
  const figure = page.locator('figure').nth(index);
  const end = figure.getByRole('button', { name: 'Jump to the end' });
  if ((await end.count()) > 0) await end.click();
  return figure;
}

/** A numbered figure, e.g. figureByNumber(page, '2.1'). */
export function figureByNumber(page: Page, number: string) {
  return page.locator(`figure[aria-labelledby="figure-${number}"]`);
}
