/** Fachlicher Suchzustand – unabhängig von Sharedien und von der URL-Darstellung. */

export type SearchMode = 'or' | 'and';
export type ViewMode = 'justified' | 'grid' | 'list';

export interface DateRange {
  /** ISO-Datum yyyy-mm-dd (inklusive). */
  from?: string;
  to?: string;
}

export interface TextFilterValue {
  op: string;
  value: string;
}

export interface GeoBox {
  north: number;
  west: number;
  south: number;
  east: number;
}

export interface SearchState {
  q: string;
  mode: SearchMode;
  ai: boolean;
  /** Facetten- und Relationsfilter: source → gewählte Werte (Identifier). */
  facets: Record<string, string[]>;
  dates: Record<string, DateRange>;
  texts: Record<string, TextFilterValue>;
  category?: string;
  geo?: GeoBox;
  sort: string;
}

export function emptySearchState(sort = 'relevance'): SearchState {
  return { q: '', mode: 'or', ai: false, facets: {}, dates: {}, texts: {}, sort };
}

/** Anzahl aktiver Filter (ohne Suchbegriff und Sortierung). */
export function activeFilterCount(state: SearchState): number {
  return (
    Object.values(state.facets).reduce((n, values) => n + values.length, 0) +
    Object.values(state.dates).filter((d) => d.from || d.to).length +
    Object.values(state.texts).filter((t) => t.value).length +
    (state.category ? 1 : 0) +
    (state.geo ? 1 : 0)
  );
}

export function hasCriteria(state: SearchState): boolean {
  return state.q.trim() !== '' || activeFilterCount(state) > 0;
}

/** Stabiler Schlüssel (z. B. für Caches). */
export function stateKey(state: SearchState): string {
  const sortObject = (obj: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
  return JSON.stringify({
    ...state,
    facets: sortObject(Object.fromEntries(Object.entries(state.facets).map(([k, v]) => [k, [...v].sort()]))),
    dates: sortObject(state.dates),
    texts: sortObject(state.texts),
  });
}

const PREFIX = { facet: 'f.', date: 'd.', text: 't.' } as const;

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/** Suchzustand → URL-Parameter (Standardwerte werden weggelassen). */
export function stateToParams(state: SearchState, defaultSort = 'relevance'): URLSearchParams {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set('q', state.q.trim());
  if (state.mode === 'and') params.set('mode', 'and');
  if (state.ai) params.set('ai', '1');
  if (state.category) params.set('cat', state.category);
  for (const [source, values] of Object.entries(state.facets)) {
    for (const value of values) params.append(PREFIX.facet + source, value);
  }
  for (const [source, range] of Object.entries(state.dates)) {
    if (range.from || range.to) params.set(PREFIX.date + source, `${range.from ?? ''}..${range.to ?? ''}`);
  }
  for (const [source, text] of Object.entries(state.texts)) {
    if (text.value) params.set(PREFIX.text + source, `${text.op}:${text.value}`);
  }
  if (state.geo) {
    const { north, west, south, east } = state.geo;
    params.set('geo', [north, west, south, east].map(round).join(','));
  }
  if (state.sort && state.sort !== defaultSort) params.set('sort', state.sort);
  return params;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** URL-Parameter → Suchzustand (ungültige Werte werden ignoriert). */
export function paramsToState(params: URLSearchParams, defaultSort = 'relevance'): SearchState {
  const state = emptySearchState(defaultSort);
  state.q = params.get('q') ?? '';
  state.mode = params.get('mode') === 'and' ? 'and' : 'or';
  state.ai = params.get('ai') === '1';
  state.category = params.get('cat') || undefined;
  state.sort = params.get('sort') || defaultSort;
  for (const [key, value] of params) {
    if (key.startsWith(PREFIX.facet) && value) {
      const source = key.slice(PREFIX.facet.length);
      const values = (state.facets[source] ??= []);
      if (!values.includes(value)) values.push(value);
    } else if (key.startsWith(PREFIX.date)) {
      const [from, to] = value.split('..');
      const range: DateRange = {};
      if (from && ISO_DATE.test(from)) range.from = from;
      if (to && ISO_DATE.test(to)) range.to = to;
      if (range.from || range.to) state.dates[key.slice(PREFIX.date.length)] = range;
    } else if (key.startsWith(PREFIX.text)) {
      const index = value.indexOf(':');
      if (index > 0 && value.slice(index + 1)) {
        state.texts[key.slice(PREFIX.text.length)] = {
          op: value.slice(0, index),
          value: value.slice(index + 1),
        };
      }
    }
  }
  const geo = params.get('geo')?.split(',').map(Number);
  if (geo?.length === 4 && geo.every(Number.isFinite)) {
    const [north, west, south, east] = geo;
    state.geo = { north, west, south, east };
  }
  return state;
}
