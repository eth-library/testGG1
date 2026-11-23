import { app } from '../app/services.ts';
import type { CategoryInfo, CategoryNode } from './model.ts';

/** Zwischenspeicher für Kategorien (Sammlungen) – geteilt von Filter, Sammlungs- und Startseite. */
const children = new Map<string, Promise<CategoryNode[]>>();
const nodes = new Map<string, Promise<CategoryInfo>>();
const paths = new Map<string, Promise<CategoryNode[]>>();
let locale = '';

function ensureLocale() {
  const current = app().i18n.locale;
  if (current !== locale) {
    locale = current;
    children.clear();
    nodes.clear();
    paths.clear();
  }
}

function cached<T>(map: Map<string, Promise<T>>, key: string, load: () => Promise<T>): Promise<T> {
  ensureLocale();
  let promise = map.get(key);
  if (!promise) {
    promise = load();
    map.set(key, promise);
    promise.catch(() => map.delete(key));
  }
  return promise;
}

export const categories = {
  root(): string {
    return app().config.catalog.rootCategory;
  },
  children(id: string): Promise<CategoryNode[]> {
    return cached(children, id, () => app().catalog.getCategoryChildren(id));
  },
  node(id: string): Promise<CategoryInfo> {
    return cached(nodes, id, () => app().catalog.getCategory(id));
  },
  /** Pfad von der Wurzel bis zum Knoten (inklusive). */
  path(id: string): Promise<CategoryNode[]> {
    return cached(paths, id, () => app().catalog.getCategoryPath(id));
  },
};
