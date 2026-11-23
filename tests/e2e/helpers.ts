import { expect, type Page } from '@playwright/test';
import { buildAssets } from '../../src/data/mock/fixtures.ts';

export const ASSETS = buildAssets();

/** Startet die App ohne künstliche Mock-Verzögerung. */
export async function open(page: Page, path = '/'): Promise<void> {
  const separator = path.includes('?') ? '&' : '?';
  await page.goto(`${path}${separator}mockDelay=0&lang=de`);
  await expect(page.locator('ep-app')).toBeAttached();
}

export function cards(page: Page) {
  return page.locator('ep-asset-card');
}

/** Wartet, bis die Trefferliste gefüllt ist. */
export async function waitForResults(page: Page, min = 1): Promise<void> {
  await expect.poll(async () => cards(page).count()).toBeGreaterThanOrEqual(min);
}

/** Letzte Requests an den Sharedien-Mock. */
export async function mockLog(
  page: Page,
): Promise<Array<{ method: string; path: string; body?: unknown; query: Record<string, string> }>> {
  return page.evaluate(() => window.__epMock?.log ?? []);
}
