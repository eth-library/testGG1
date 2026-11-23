import type { Analytics } from '../analytics/matomo.ts';
import type { AppConfig } from '../config/schema.ts';
import type { CatalogAdapter } from '../data/model.ts';
import type { I18n } from '../i18n/i18n.ts';
import type { Router } from '../router/router.ts';
import type { BasketStore } from '../state/basket-store.ts';
import type { SearchStore } from '../state/search-store.ts';
import type { ThemeController } from '../theme/theme-controller.ts';
import type { Toaster } from '../ui/toaster.ts';

export interface Services {
  config: AppConfig;
  i18n: I18n;
  theme: ThemeController;
  router: Router;
  analytics: Analytics;
  catalog: CatalogAdapter;
  search: SearchStore;
  basket: BasketStore;
  toast: Toaster;
}

let current: Services | undefined;

export function setServices(services: Services): void {
  current = services;
}

/** Zugriff auf die App-Dienste (nach dem Start in main.ts verfügbar). */
export function app(): Services {
  if (!current) throw new Error('App-Dienste sind noch nicht initialisiert');
  return current;
}
