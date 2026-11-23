import type { Analytics } from '../analytics/matomo.ts';
import type { AppConfig, FilterConfig } from '../config/schema.ts';
import type { Asset, CatalogAdapter, FacetCounts } from '../data/model.ts';
import type { Location, Router } from '../router/router.ts';
import { matchRoute } from '../router/router.ts';
import {
  emptySearchState,
  paramsToState,
  stateKey,
  stateToParams,
  type SearchState,
  type ViewMode,
} from './search-state.ts';
import { Store, storage } from './store.ts';

export interface SearchResults {
  key: string;
  items: Asset[];
  total: number;
  cursor?: string;
  facets: FacetCounts;
  loading: boolean;
  loadingMore: boolean;
  error?: unknown;
  /** Wurde die Suche für diesen Schlüssel bereits einmal ausgeführt? */
  ready: boolean;
}

interface SearchStoreState {
  query: SearchState;
  results: SearchResults;
  view: ViewMode;
  /** Zielhöhe der Bildreihen in px (Justified Grid) bzw. Kachelbreite. */
  size: number;
  /** Zur Laufzeit hinzugefügte Filter («Filter hinzufügen»). */
  extraFilters: FilterConfig[];
  /** Aktive Seite, deren Suche angezeigt wird. */
  scope: 'search' | 'collection' | 'map' | 'none';
}

const SEARCH_ROUTES = new Set(['search', 'collection', 'map']);

const emptyResults = (key = ''): SearchResults => ({
  key,
  items: [],
  total: 0,
  facets: {},
  loading: false,
  loadingMore: false,
  ready: false,
});

/**
 * Verbindet URL (einzige Quelle der Wahrheit), Suchzustand und Trefferliste.
 * Komponenten ändern den Zustand über `update()`; daraus entsteht eine neue URL,
 * und die Routenänderung löst die Suche aus.
 */
export class SearchStore extends Store<SearchStoreState> {
  #abort?: AbortController;
  #timer?: number;
  #lastTrackedKey = '';

  constructor(
    private readonly config: AppConfig,
    private readonly catalog: CatalogAdapter,
    private readonly router: Router,
    private readonly analytics: Analytics,
  ) {
    super({
      query: emptySearchState(config.search.defaultSort),
      results: emptyResults(),
      view: storage.get<ViewMode>('ep-view', config.search.defaultView),
      size: storage.get<number>('ep-size', 220),
      extraFilters: storage.get<FilterConfig[]>('ep-extra-filters', []),
      scope: 'none',
    });
    router.subscribe(() => this.#syncFromLocation(router.location));
    this.#syncFromLocation(router.location);
  }

  /** Alle aktiven Filterdefinitionen (Config + zur Laufzeit hinzugefügte). */
  get filters(): FilterConfig[] {
    const configured = this.config.filters;
    const extra = this.state.extraFilters.filter(
      (f) => !configured.some((c) => c.type === f.type && c.source === f.source),
    );
    return [...configured, ...extra];
  }

  get facetSources(): string[] {
    return this.filters
      .filter((f) => (f.type === 'facet' || f.type === 'relation') && f.source)
      .map((f) => f.source!) as string[];
  }

  /** Neuer Suchzustand → neue URL. `replace` für fortlaufende Eingaben. */
  update(patch: Partial<SearchState>, options: { replace?: boolean } = {}): void {
    const next: SearchState = { ...this.state.query, ...patch };
    const loc = this.router.location;
    const params = stateToParams(next, this.config.search.defaultSort);
    const view = this.state.view;
    if (view !== this.config.search.defaultView) params.set('view', view);
    if (loc.route.name === 'collection') {
      // Auf Sammlungsseiten steckt die Kategorie im Pfad.
      const category = next.category ?? loc.route.id;
      params.delete('cat');
      this.router.navigate(this.router.href(`/sammlung/${encodeURIComponent(category)}`, params), options);
      return;
    }
    if (loc.route.name === 'map') {
      this.router.navigate(this.router.href('/karte', params), options);
      return;
    }
    this.router.navigate(this.router.href('/suche', params), options);
  }

  reset(): void {
    const loc = this.router.location;
    const base = emptySearchState(this.config.search.defaultSort);
    if (loc.route.name === 'collection') base.category = loc.route.id;
    this.update({ ...base, q: '' });
  }

  setView(view: ViewMode): void {
    storage.set('ep-view', view);
    this.set({ view });
  }

  setSize(size: number): void {
    storage.set('ep-size', size);
    this.set({ size });
  }

  addFilter(filter: FilterConfig): void {
    const extra = [...this.state.extraFilters.filter((f) => f.source !== filter.source), filter];
    storage.set('ep-extra-filters', extra);
    this.set({ extraFilters: extra });
  }

  removeFilter(source: string): void {
    const extra = this.state.extraFilters.filter((f) => f.source !== source);
    storage.set('ep-extra-filters', extra);
    const { facets, dates, texts } = this.state.query;
    this.set({ extraFilters: extra });
    const without = <T>(record: Record<string, T>) =>
      Object.fromEntries(Object.entries(record).filter(([key]) => key !== source));
    this.update({ facets: without(facets), dates: without(dates), texts: without(texts) });
  }

  /** Nächste Seite (Cursor) nachladen. */
  async loadMore(): Promise<void> {
    const { results, query } = this.state;
    if (!results.cursor || results.loadingMore || results.loading) return;
    const key = results.key;
    this.set({ results: { ...results, loadingMore: true } });
    try {
      const page = await this.catalog.search({
        state: query,
        pageSize: this.config.catalog.pageSize,
        cursor: results.cursor,
        facetSources: [],
      });
      if (this.state.results.key !== key) return;
      const known = new Set(this.state.results.items.map((a) => a.id));
      this.set({
        results: {
          ...this.state.results,
          items: [...this.state.results.items, ...page.items.filter((a) => !known.has(a.id))],
          cursor: page.cursor,
          loadingMore: false,
        },
      });
    } catch (error) {
      if (this.state.results.key === key) {
        this.set({ results: { ...this.state.results, loadingMore: false, error } });
      }
    }
  }

  /** Erneut suchen (z. B. nach Sprachwechsel oder Fehler). */
  refresh(): void {
    this.#run(this.state.query, true);
  }

  #syncFromLocation(loc: Location): void {
    // Liegt eine Detailansicht als Overlay über einer Suchseite, bleibt deren Suche aktiv.
    let effective = loc;
    if (loc.route.name === 'asset' && loc.state.overlayOf) {
      const url = new URL(loc.state.overlayOf, location.origin);
      effective = {
        ...loc,
        route: matchRoute(url.pathname.slice(this.router.base.length) || '/'),
        query: url.searchParams,
      };
    }
    const route = effective.route;
    if (!SEARCH_ROUTES.has(route.name)) {
      if (this.state.scope !== 'none' && loc.route.name !== 'asset') this.set({ scope: 'none' });
      return;
    }
    const query = paramsToState(effective.query, this.config.search.defaultSort);
    if (route.name === 'collection') query.category = route.id;
    const view = effective.query.get('view');
    if (view === 'justified' || view === 'grid' || view === 'list') {
      if (view !== this.state.view) this.set({ view });
    }
    // Werte für Felder ohne konfigurierten Filter → Filter automatisch einblenden.
    const known = new Set(this.filters.map((f) => f.source));
    const defs = this.catalog.fieldDefinitions();
    const added: FilterConfig[] = [];
    for (const source of Object.keys(query.facets)) {
      if (!known.has(source))
        added.push({ type: this.catalog.relationTypes().has(source) ? 'relation' : 'facet', source });
    }
    for (const source of Object.keys(query.dates))
      if (!known.has(source)) added.push({ type: 'date', source });
    for (const source of Object.keys(query.texts))
      if (!known.has(source) && defs.has(source)) added.push({ type: 'text', source });
    if (added.length) this.set({ extraFilters: [...this.state.extraFilters, ...added] });

    const scope = route.name as SearchStoreState['scope'];
    this.set({ query, scope });
    this.#run(query);
  }

  #run(query: SearchState, force = false): void {
    const key = stateKey(query);
    const { results } = this.state;
    if (!force && results.key === key && (results.ready || results.loading)) return;
    this.#abort?.abort();
    window.clearTimeout(this.#timer);
    const controller = new AbortController();
    this.#abort = controller;
    this.set({
      results: { ...emptyResults(key), items: results.key === key ? results.items : [], loading: true },
    });
    this.#timer = window.setTimeout(async () => {
      try {
        const page = await this.catalog.search(
          {
            state: query,
            pageSize: this.config.catalog.pageSize,
            facetSources: this.facetSources,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        this.set({
          results: {
            key,
            items: page.items,
            total: page.total,
            cursor: page.cursor,
            facets: page.facets ?? {},
            loading: false,
            loadingMore: false,
            ready: true,
          },
        });
        if (key !== this.#lastTrackedKey && query.q.trim()) {
          this.#lastTrackedKey = key;
          this.analytics.siteSearch(query.q, query.category ?? false, page.total);
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError' || controller.signal.aborted) return;
        console.error('[epics] Suche fehlgeschlagen', error);
        this.set({ results: { ...emptyResults(key), error, ready: true } });
      }
    }, 90);
  }
}
