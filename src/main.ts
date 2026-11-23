import './styles/global.css';
import { Analytics } from './analytics/matomo.ts';
import { setServices } from './app/services.ts';
import { ConfigError, loadConfig } from './config/load-config.ts';
import type { FieldType } from './data/model.ts';
import { SharedienClient } from './data/sharedien/client.ts';
import { I18n } from './i18n/i18n.ts';
import { Router } from './router/router.ts';
import { BasketStore } from './state/basket-store.ts';
import { SearchStore } from './state/search-store.ts';
import { ThemeController } from './theme/theme-controller.ts';
import { registerIcons } from './ui/icons.ts';
import { Toaster } from './ui/toaster.ts';

async function boot(): Promise<void> {
  const config = await loadConfig();
  registerIcons();
  const i18n = new I18n(config.locales.ui, config.locales.default);
  const theme = new ThemeController(config);
  document.documentElement.style.removeProperty('background');
  const router = new Router();
  const analytics = new Analytics(config.analytics.matomo);

  const formatDate = (iso: string, type: FieldType) => {
    // Jahr allein, Jahr-Monat oder volles Datum je nach Präzision anzeigen.
    if (/^\d{4}$/.test(iso)) return iso;
    if (/^\d{4}-\d{2}$/.test(iso)) {
      return new Date(`${iso}-01T00:00:00Z`).toLocaleDateString(i18n.intlLocale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(i18n.intlLocale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      ...(type === 'datetime' ? { hour: '2-digit', minute: '2-digit' } : { timeZone: 'UTC' }),
    });
  };
  const formatBytes = (bytes: number) => {
    const units = ['B', 'kB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < units.length - 1) {
      value /= 1000;
      unit++;
    }
    return `${value.toLocaleString(i18n.intlLocale, { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
  };

  let mockFetch: typeof fetch | undefined;
  if (config.api.mock) {
    const { createMockFetch } = await import('./data/mock/mock-fetch.ts');
    const delayParam = new URLSearchParams(location.search).get('mockDelay');
    mockFetch = createMockFetch({ delay: delayParam !== null ? Number(delayParam) : undefined });
    if (!config.api.baseUrl) config.api.baseUrl = `${location.origin}/mock`;
  }
  const catalog = new SharedienClient(config, { fetch: mockFetch, formatDate, formatBytes });
  await catalog.init(i18n.locale);

  const toast = new Toaster();
  const basket = new BasketStore(config);
  const search = new SearchStore(config, catalog, router, analytics);
  setServices({ config, i18n, theme, router, analytics, catalog, search, basket, toast });

  i18n.subscribe(async () => {
    await catalog.setLocale(i18n.locale);
    search.refresh();
  });

  await import('./ui/wa.ts');
  await import('./components/shell/ep-app.ts');
  document.getElementById('ep-boot')?.remove();
  document.body.append(document.createElement('ep-app'));
}

boot().catch((error: unknown) => {
  console.error('[epics] Start fehlgeschlagen', error);
  const container = document.getElementById('ep-boot') ?? document.body;
  const issues = error instanceof ConfigError ? error.issues : [String(error)];
  container.innerHTML = '';
  const box = document.createElement('div');
  const title = document.createElement('h1');
  title.textContent =
    error instanceof ConfigError ? 'Konfigurationsfehler' : 'Der Bildkatalog konnte nicht gestartet werden';
  const text = document.createElement('p');
  text.textContent = error instanceof Error ? error.message : 'Unbekannter Fehler';
  const details = document.createElement('pre');
  details.textContent = issues.join('\n');
  box.append(title, text, details);
  container.append(box);
});
