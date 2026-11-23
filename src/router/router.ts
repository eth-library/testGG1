import { legacyHashToPath } from './legacy-hash.ts';

export type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'collections' }
  | { name: 'collection'; id: string }
  | { name: 'asset'; id: string }
  | { name: 'map' }
  | { name: 'selection' }
  | { name: 'notFound' };

export interface HistoryState {
  /** Pfad + Query der Seite, über der eine Detailansicht als Overlay liegt. */
  overlayOf?: string;
  /** Scrollposition beim Verlassen der Seite. */
  scrollY?: number;
}

export interface Location {
  route: Route;
  path: string;
  query: URLSearchParams;
  state: HistoryState;
}

const ROUTES: Array<[RegExp, (m: RegExpMatchArray) => Route]> = [
  [/^\/?$/, () => ({ name: 'home' })],
  [/^\/suche\/?$/, () => ({ name: 'search' })],
  [/^\/sammlungen\/?$/, () => ({ name: 'collections' })],
  [/^\/sammlung\/([^/]+)\/?$/, (m) => ({ name: 'collection', id: decodeURIComponent(m[1]) })],
  [/^\/bild\/([^/]+)\/?$/, (m) => ({ name: 'asset', id: decodeURIComponent(m[1]) })],
  [/^\/karte\/?$/, () => ({ name: 'map' })],
  [/^\/auswahl\/?$/, () => ({ name: 'selection' })],
];

export function matchRoute(path: string): Route {
  for (const [pattern, build] of ROUTES) {
    const match = path.match(pattern);
    if (match) return build(match);
  }
  return { name: 'notFound' };
}

/** Kleiner History-API-Router. Links (`<a href>`) werden auch aus Shadow-DOMs abgefangen. */
export class Router extends EventTarget {
  readonly base: string;
  #location!: Location;

  constructor(base = import.meta.env.BASE_URL ?? '/') {
    super();
    this.base = base.endsWith('/') ? base.slice(0, -1) : base;
    this.#redirectLegacyHash();
    this.#read();
    window.addEventListener('popstate', () => this.#update());
    document.addEventListener('click', (event) => this.#onClick(event));
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }

  get location(): Location {
    return this.#location;
  }

  subscribe(listener: () => void): () => void {
    this.addEventListener('change', listener);
    return () => this.removeEventListener('change', listener);
  }

  /** Absoluter Pfad inkl. Base, z. B. für `href`. */
  href(path: string, query?: URLSearchParams | Record<string, string>): string {
    const qs = query ? new URLSearchParams(query).toString() : '';
    return `${this.base}${path}${qs ? `?${qs}` : ''}`;
  }

  navigate(href: string, options: { replace?: boolean; state?: HistoryState } = {}): void {
    const url = new URL(href, location.origin);
    const current = location.pathname + location.search;
    if (!options.replace) {
      // Scrollposition der verlassenen Seite merken (für «Zurück»).
      history.replaceState({ ...(history.state ?? {}), scrollY: window.scrollY }, '');
    }
    const next = url.pathname + url.search + url.hash;
    if (next === current && !options.state) return;
    if (options.replace) history.replaceState(options.state ?? {}, '', next);
    else history.pushState(options.state ?? {}, '', next);
    this.#update();
  }

  /** Aktualisiert nur die Query der aktuellen Seite. */
  setQuery(query: URLSearchParams, options: { replace?: boolean } = {}): void {
    const qs = query.toString();
    const href = location.pathname + (qs ? `?${qs}` : '');
    if (href === location.pathname + location.search) return;
    this.navigate(href, { replace: options.replace, state: options.replace ? history.state : undefined });
  }

  back(fallback = '/'): void {
    if (history.length > 1 && history.state) history.back();
    else this.navigate(this.href(fallback));
  }

  #redirectLegacyHash(): void {
    if (!location.hash) return;
    const path = legacyHashToPath(location.hash);
    if (path) history.replaceState({}, '', this.base + path);
  }

  #read(): void {
    const path = location.pathname.startsWith(this.base)
      ? location.pathname.slice(this.base.length) || '/'
      : location.pathname;
    this.#location = {
      route: matchRoute(path),
      path,
      query: new URLSearchParams(location.search),
      state: (history.state as HistoryState | null) ?? {},
    };
  }

  #update(): void {
    this.#read();
    this.dispatchEvent(new Event('change'));
  }

  #onClick(event: MouseEvent): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const anchor = event
      .composedPath()
      .find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement);
    if (!anchor || !anchor.href || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
    if (anchor.dataset.router === 'off') return;
    const url = new URL(anchor.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(this.base)) return;
    event.preventDefault();
    const overlay = anchor.dataset.overlay === 'true';
    this.navigate(url.pathname + url.search + url.hash, {
      state: overlay ? { overlayOf: overlayBase(this.#location) } : undefined,
    });
  }
}

/** Die Seite, über der ein Overlay geöffnet wird (bei verschachtelten Overlays bleibt die ursprüngliche). */
function overlayBase(loc: Location): string {
  if (loc.route.name === 'asset' && loc.state.overlayOf) return loc.state.overlayOf;
  const qs = loc.query.toString();
  return loc.path + (qs ? `?${qs}` : '');
}
