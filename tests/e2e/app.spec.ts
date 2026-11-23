import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { ASSETS, cards, mockLog, open, waitForResults } from './helpers.ts';

test.describe('Startseite', () => {
  test('zeigt Hero, Sammlungen und führt zur Suche', async ({ page }) => {
    await open(page, '/');
    await expect(page.locator('ep-home-page h1')).toContainText('Bildarchiv');
    await expect(page.locator('ep-collection-card').first()).toBeVisible();
    const input = page.locator('ep-home-page ep-search-bar input');
    await input.fill('Gletscher');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/suche\?q=Gletscher/);
    await waitForResults(page);
  });
});

test.describe('Suche und Filter', () => {
  test('filtert per Facette und entfernt den Filter über den Chip', async ({ page }) => {
    await open(page, '/suche');
    await waitForResults(page);
    const count = page.locator('ep-search-page .toolbar .count');
    await expect(count).toContainText('120 Treffer');
    const facet = page.locator('ep-facet-filter').first().locator('label').first();
    await facet.click();
    await expect(page).toHaveURL(/f\.ba_photographer=/);
    await expect(count).not.toContainText('120 Treffer');
    const chip = page.locator('ep-active-filters .chip');
    await expect(chip).toHaveCount(1);
    await chip.locator('button').click();
    await expect(page).not.toHaveURL(/f\.ba_photographer=/);
    await expect(count).toContainText('120 Treffer');
  });

  test('filtert nach Jahrzehnt und nach Sammlung', async ({ page }) => {
    await open(page, '/suche');
    await waitForResults(page);
    await page.locator('ep-date-filter .decades button', { hasText: '1900' }).click();
    await expect(page).toHaveURL(/d\.ba_date=1900-01-01\.\.1909-12-31/);
    await page.locator('ep-category-filter li button', { hasText: 'Luftbilder' }).click();
    await expect(page).toHaveURL(/cat=cat_luftbilder/);
    await expect
      .poll(async () => (await mockLog(page)).filter((e) => e.path === 'assets/search').at(-1)?.body)
      .toMatchObject({ categories: ['cat_luftbilder'], advancedSearchFilters: [{ op: 'Between' }] });
  });

  test('wechselt die Ansicht und lädt beim Scrollen nach', async ({ page }) => {
    await open(page, '/suche');
    await waitForResults(page, 60);
    await page.locator('ep-search-page .views button[aria-label="Liste"]').click();
    await expect(page.locator('ep-results-table table')).toBeVisible();
    await page.locator('ep-search-page .views button[aria-label="Raster"]').click();
    await expect(page.locator('ep-asset-card[variant="tile"]').first()).toBeVisible();
    await page.locator('ep-search-page .views button[aria-label="Galerie"]').click();
    for (let i = 0; i < 6 && (await cards(page).count()) <= 60; i++) {
      await page.mouse.wheel(0, 4000);
      await page.waitForTimeout(250);
    }
    await expect.poll(() => cards(page).count()).toBeGreaterThan(60);
  });

  test('Suchbegriff mit UND-Verknüpfung landet im Request', async ({ page }) => {
    await open(page, '/suche');
    const input = page.locator('ep-header ep-search-bar input');
    await input.fill('Zürich Strassenszene');
    await page.locator('ep-header ep-search-bar .chip', { hasText: 'ODER' }).click();
    await input.press('Enter');
    await expect(page).toHaveURL(/q=Z%C3%BCrich\+Strassenszene&mode=and/);
    await expect
      .poll(async () => (await mockLog(page)).filter((e) => e.path === 'assets/search').at(-1)?.body)
      .toMatchObject({ q: 'Zürich Strassenszene', operator: 'And' });
  });
});

test.describe('Detailansicht', () => {
  test('öffnet als Overlay, blättert mit Pfeiltasten und schliesst mit Esc', async ({ page }) => {
    await open(page, '/suche?q=Zürich');
    await waitForResults(page);
    await cards(page).first().locator('a.card').click();
    const viewer = page.locator('ep-asset-viewer[mode="overlay"]');
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('ep-asset-info h1')).not.toBeEmpty();
    const first = page.url();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.url()).not.toBe(first);
    await expect(page).toHaveURL(/\/bild\//);
    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);
    await expect(page).toHaveURL(/\/suche\?q=Z%C3%BCrich/);
  });

  test('Deep Zoom und Download-Formate', async ({ page }) => {
    await open(page, `/bild/${ASSETS[0].id}`);
    const viewer = page.locator('ep-asset-viewer[mode="page"]');
    await expect(viewer.locator('ep-asset-info h1')).toHaveText(ASSETS[0].title);
    await viewer.locator('button[aria-label="Zoomen"]').click();
    await expect(viewer.locator('ep-zoom canvas').first()).toBeAttached();
    await viewer.locator('ep-download-menu wa-button').click();
    await expect(viewer.locator('wa-dropdown-item', { hasText: 'Original (TIFF)' })).toBeVisible();
    await expect(viewer.locator('wa-dropdown-item', { hasText: 'Quadratisch' })).toBeVisible();
  });

  test('Drill-down: Klick auf einen Metadatenwert startet eine Suche', async ({ page }) => {
    await open(page, `/bild/${ASSETS[1].id}`);
    const link = page.locator('ep-asset-info a.value').first();
    await link.click();
    await expect(page).toHaveURL(/\/suche\?f\./);
    await waitForResults(page);
  });

  test('alte anura-Links werden weitergeleitet', async ({ page }) => {
    await page.goto(`/?mockDelay=0#detail-asset=${ASSETS[2].id}`);
    await expect(page).toHaveURL(new RegExp(`/bild/${ASSETS[2].id}`));
    await expect(page.locator('ep-asset-info h1')).toHaveText(ASSETS[2].title);
  });
});

test.describe('Auswahl, Export und Vergleich', () => {
  test('ZIP-Download mit gewählten Formaten', async ({ page }) => {
    await open(page, '/suche');
    await waitForResults(page);
    const first = cards(page).nth(0);
    const second = cards(page).nth(1);
    await first.hover();
    await first.locator('.action').click();
    await second.hover();
    await second.locator('.action').click();
    await page.locator('ep-basket-button wa-button').click();
    const drawer = page.locator('ep-basket-drawer');
    await expect(drawer.locator('li')).toHaveCount(2);
    const zip = drawer.locator('wa-button', { hasText: 'Als ZIP herunterladen' });
    await expect(zip).toHaveAttribute('disabled', '');
    await drawer.locator('wa-checkbox').click();
    const download = page.waitForEvent('download');
    await zip.click();
    expect((await download).suggestedFilename()).toBe('bildarchiv-auswahl.zip');
    const request = (await mockLog(page)).find((e) => e.path === 'assets/stream-formdata')!;
    const payload = JSON.parse((request.body as Record<string, string>).zipDownloadRequest);
    expect(payload.assets).toHaveLength(2);
    expect(payload.assets[0].derivationTypeIdentifier).toBe('Screen');
  });

  test('geteilte Auswahl übernehmen', async ({ page }) => {
    await open(page, `/auswahl?ids=${ASSETS[0].id},${ASSETS[1].id},${ASSETS[2].id}`);
    await waitForResults(page, 3);
    await page.locator('ep-selection-page wa-button').click();
    await expect(page.locator('ep-basket-drawer li')).toHaveCount(3);
  });

  test('CSV-Export und Bildvergleich über die Auswahlleiste', async ({ page }) => {
    await open(page, '/suche');
    await waitForResults(page);
    await page.locator('ep-search-page wa-button', { hasText: 'Auswählen' }).click();
    await cards(page).nth(0).locator('a.card').click();
    await cards(page).nth(1).locator('a.card').click();
    await expect(page.locator('.selbar .n')).toContainText('2 ausgewählt');
    const download = page.waitForEvent('download');
    await page.locator('.selbar button', { hasText: 'Metadaten (CSV)' }).click();
    const file = await (await download).path();
    const csv = readFileSync(file!, 'utf8');
    expect(csv.split('\r\n')).toHaveLength(3);
    expect(csv).toContain('Bildcode;Titel;Datierung');
    await page.locator('.selbar button', { hasText: 'Vergleichen' }).click();
    await expect(page.locator('ep-compare-dialog wa-comparison')).toBeVisible();
  });
});

test.describe('Karte', () => {
  test('zeigt Cluster und sucht im Ausschnitt', async ({ page }) => {
    await open(page, '/karte');
    await expect(page.locator('ep-map-page .cluster, ep-map-page .marker').first()).toBeVisible({
      timeout: 15_000,
    });
    await page.locator('ep-map-page wa-button', { hasText: 'In diesem Ausschnitt suchen' }).click();
    await expect(page).toHaveURL(/\/karte\?geo=/);
    await expect(page.locator('ep-map-page ep-active-filters .chip')).toContainText('Kartenausschnitt');
  });
});

test.describe('Darstellung und Sprache', () => {
  test('Dunkelmodus bleibt nach dem Neuladen erhalten', async ({ page }) => {
    await open(page, '/');
    await page.locator('ep-theme-switch wa-button').click();
    await page.locator('ep-theme-switch wa-dropdown-item[value="dark"]').click();
    await expect(page.locator('html')).toHaveClass(/wa-dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/wa-dark/);
  });

  test('wechselt die Sprache', async ({ page }) => {
    await open(page, '/suche');
    await page.locator('ep-lang-switch button', { hasText: 'EN' }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('ep-search-page .toolbar .count')).toContainText('results');
    await expect(page.locator('ep-filter-panel .toggle').first()).toContainText('Collection');
    // Sammlungsnamen kommen aus den Daten und müssen nach dem Wechsel ebenfalls englisch sein.
    await expect(
      page.locator('ep-category-filter li button', { hasText: 'Aerial photographs' }),
    ).toBeVisible();
  });

  test('Zurück-Taste stellt die Suche wieder her', async ({ page }) => {
    await open(page, '/suche?q=See');
    await waitForResults(page);
    await page.locator('ep-header nav a', { hasText: 'Sammlungen' }).click();
    await expect(page).toHaveURL(/\/sammlungen/);
    await page.goBack();
    await expect(page).toHaveURL(/\/suche\?q=See/);
    await waitForResults(page);
  });
});

test.describe('Barrierefreiheit', () => {
  for (const path of ['/', '/suche', `/bild/${ASSETS[0].id}`, '/sammlungen']) {
    test(`keine schweren axe-Verstösse auf ${path}`, async ({ page }) => {
      await open(page, path);
      await page.waitForTimeout(800);
      // «label-title-only» meldet bei <wa-select> fälschlich ein fehlendes Label (aria-labelledby im
      // Shadow DOM); die Regel «label» prüft dasselbe Element und besteht.
      const result = await new AxeBuilder({ page: page as never })
        .disableRules(['region', 'label-title-only'])
        .analyze();
      const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});

test.describe('Mobil @mobile', () => {
  test('Filter als Drawer und Detailansicht @mobile', async ({ page }) => {
    await open(page, '/suche');
    await waitForResults(page);
    await page.locator('ep-search-page wa-button', { hasText: 'Filter' }).first().click();
    await expect(page.locator('ep-search-page wa-drawer ep-filter-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await cards(page).first().locator('a.card').click();
    await expect(page.locator('ep-asset-viewer[mode="overlay"] ep-asset-info h1')).toBeVisible();
  });
});
