import { css, html, nothing, unsafeCSS } from 'lit';
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import maplibreCss from 'maplibre-gl/dist/maplibre-gl.css?inline';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import type { Asset } from '../../data/model.ts';
import { offlineStyle } from './offline-style.ts';
import '../search/ep-active-filters.ts';
import '../results/ep-results.ts';

type Feature = GeoJSON.Feature<
  GeoJSON.Point,
  { id: string; title: string; thumbnail: string; date?: string }
>;

/**
 * Kartenansicht: Treffer mit Koordinaten als Bildmarker (gruppiert), Kartenausschnitt als
 * Geo-Filter («In diesem Ausschnitt suchen»), Trefferliste daneben.
 */
export class EpMapPage extends EpElement {
  static override properties = {
    features: { state: true },
    loadingMarkers: { state: true },
    limited: { state: true },
    failed: { state: true },
  };

  declare features: Feature[];
  declare loadingMarkers: boolean;
  declare limited: boolean;
  declare failed: boolean;

  #map?: MapLibreMap;
  #markers = new Map<string, Marker>();
  #markerKey = '';
  #maplibre?: typeof import('maplibre-gl');
  #themeUnsub?: () => void;

  static override styles = [
    EpElement.baseStyles,
    unsafeCSS(maplibreCss),
    css`
      :host {
        display: block;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(20rem, 30rem);
        height: calc(100dvh - var(--ep-header-h) - var(--ep-offset, 0px));
      }
      .mapwrap {
        position: relative;
        min-width: 0;
      }
      .map {
        position: absolute;
        inset: 0;
        background: var(--ep-lowered);
      }
      :host-context(.wa-dark) .map.filtered .maplibregl-canvas {
        filter: invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92);
      }
      .bar {
        position: absolute;
        top: 1rem;
        left: 1rem;
        right: 1rem;
        z-index: 2;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        pointer-events: none;
      }
      .bar > * {
        pointer-events: auto;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.9rem;
        border-radius: 999px;
        background: var(--ep-raised);
        box-shadow: var(--ep-shadow-m);
        font-size: var(--ep-text-s);
      }
      .pill strong {
        font-weight: 600;
      }
      .hint {
        position: absolute;
        left: 50%;
        bottom: 1.5rem;
        transform: translateX(-50%);
        z-index: 2;
      }
      aside {
        overflow-y: auto;
        padding: 1.25rem 1.25rem 3rem;
        border-left: 1px solid var(--ep-border);
        background: var(--ep-bg);
      }
      aside h1 {
        margin: 0 0 0.25rem;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: 2rem;
      }
      aside .count {
        margin: 0 0 1rem;
        color: var(--ep-muted);
        font-size: var(--ep-text-s);
      }
      ep-active-filters {
        margin-bottom: 1rem;
      }
      .marker {
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        border: 2.5px solid #fff;
        background: var(--ep-placeholder) center / cover no-repeat;
        box-shadow: 0 4px 14px rgb(0 0 0 / 0.35);
        cursor: pointer;
        transition: transform var(--ep-dur) var(--ep-ease);
        padding: 0;
      }
      .marker:hover,
      .marker:focus-visible {
        transform: scale(1.18);
        z-index: 5;
      }
      .cluster {
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--ep-accent);
        color: var(--ep-accent-on);
        font-size: 0.8rem;
        font-weight: 700;
        border: 3px solid color-mix(in oklab, var(--ep-accent) 35%, white);
        box-shadow: 0 4px 14px rgb(0 0 0 / 0.3);
        cursor: pointer;
        padding: 0;
        transition: transform var(--ep-dur) var(--ep-ease);
      }
      .cluster:hover {
        transform: scale(1.1);
      }
      .maplibregl-popup-content {
        padding: 0;
        border-radius: var(--ep-radius-m);
        overflow: hidden;
        background: var(--ep-raised);
        color: var(--ep-text);
        box-shadow: var(--ep-shadow-l);
      }
      .maplibregl-ctrl-group {
        background: var(--ep-raised);
        border-radius: var(--ep-radius-m);
        box-shadow: var(--ep-shadow-m);
      }
      .error {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--ep-muted);
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
          grid-template-rows: 62dvh auto;
          height: auto;
        }
        aside {
          border-left: 0;
          border-top: 1px solid var(--ep-border);
        }
      }
    `,
  ];

  constructor() {
    super();
    this.features = [];
    this.loadingMarkers = false;
    this.limited = false;
    this.failed = false;
    new StoreController(this, this.services.search);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.title = `${this.t('map.title')} – ${this.pick(this.services.config.branding.name)}`;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#themeUnsub?.();
    this.#map?.remove();
    this.#map = undefined;
    this.#markers.clear();
  }

  override async firstUpdated() {
    try {
      await this.#initMap();
    } catch (error) {
      console.error('[epics] Karte konnte nicht geladen werden', error);
      this.failed = true;
    }
  }

  #style() {
    const { config, theme } = this.services;
    const dark = theme.resolved === 'dark';
    const url = dark && config.map.styles.dark ? config.map.styles.dark : config.map.styles.light;
    const root = getComputedStyle(document.documentElement);
    const color = (name: string) => root.getPropertyValue(name).trim();
    if (!url || url === 'offline') {
      return {
        style: offlineStyle({
          bg: color('--ep-lowered'),
          land: color('--ep-surface'),
          line: color('--ep-border-strong'),
        }),
        filtered: false,
      };
    }
    return { style: url, filtered: dark && !config.map.styles.dark };
  }

  async #initMap() {
    const [maplibre, worker] = await Promise.all([
      import('maplibre-gl'),
      import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'),
    ]);
    this.#maplibre = maplibre;
    maplibre.setWorkerUrl(worker.default);
    const { config } = this.services;
    const container = this.renderRoot.querySelector<HTMLElement>('.map')!;
    const { style, filtered } = this.#style();
    container.classList.toggle('filtered', filtered);
    const map = new maplibre.Map({
      container,
      style,
      center: [config.map.center[1], config.map.center[0]],
      zoom: config.map.zoom,
      attributionControl: config.map.attribution
        ? { customAttribution: config.map.attribution }
        : { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibre.NavigationControl({ showCompass: false }), 'bottom-right');
    this.#map = map;
    map.on('load', () => {
      this.#addSource();
      void this.#loadMarkers();
    });
    map.on('moveend', () => this.#renderMarkers());
    map.on('styledata', () => {
      if (!map.getSource('assets')) this.#addSource();
    });
    // Farbschema-Wechsel → Stil neu setzen.
    this.#themeUnsub = this.services.theme.subscribe(() => {
      const next = this.#style();
      container.classList.toggle('filtered', next.filtered);
      map.setStyle(next.style as never);
    });
  }

  #addSource() {
    const map = this.#map;
    if (!map || map.getSource('assets')) return;
    map.addSource('assets', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: this.features },
      cluster: true,
      clusterRadius: 56,
      clusterMaxZoom: 14,
    });
    // Unsichtbarer Layer, damit Cluster abgefragt werden können; dargestellt wird per HTML-Marker.
    map.addLayer({
      id: 'assets-hit',
      type: 'circle',
      source: 'assets',
      paint: { 'circle-radius': 1, 'circle-opacity': 0 },
    });
    this.#renderMarkers();
  }

  protected override updated(): void {
    // Neue Suche → Marker neu laden (ohne Geo-Filter, damit die Karte nicht leerläuft).
    const { query } = this.services.search.state;
    const key = JSON.stringify({ ...query, geo: undefined });
    if (this.#map?.loaded() && key !== this.#markerKey) void this.#loadMarkers();
  }

  async #loadMarkers() {
    const { catalog, search, config } = this.services;
    const query = { ...search.state.query, geo: undefined };
    const key = JSON.stringify(query);
    this.#markerKey = key;
    this.loadingMarkers = true;
    const features: Feature[] = [];
    let cursor: string | undefined;
    let limited = false;
    try {
      do {
        const page = await catalog.search({ state: query, pageSize: 200, cursor, facetSources: [] });
        if (this.#markerKey !== key) return;
        for (const asset of page.items) {
          if (asset.coordinates) features.push(this.#feature(asset));
        }
        cursor = page.cursor;
        if (features.length >= config.map.maxMarkers) {
          limited = !!cursor;
          break;
        }
      } while (cursor);
    } finally {
      if (this.#markerKey === key) this.loadingMarkers = false;
    }
    this.features = features;
    this.limited = limited;
    (this.#map?.getSource('assets') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features,
    });
    this.#focus();
  }

  #feature(asset: Asset): Feature {
    const [lat, lng] = asset.coordinates!;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: { id: asset.id, title: asset.title, thumbnail: asset.thumbnail, date: asset.date },
    };
  }

  /** ?focus=<id> → auf ein Bild zoomen. */
  #focus() {
    const id = this.services.router.location.query.get('focus');
    const feature = id && this.features.find((f) => f.properties.id === id);
    if (feature && this.#map) {
      this.#map.flyTo({ center: feature.geometry.coordinates as [number, number], zoom: 13, duration: 1200 });
    } else if (this.features.length && this.#map && !this.services.search.state.query.geo) {
      const lngs = this.features.map((f) => f.geometry.coordinates[0]);
      const lats = this.features.map((f) => f.geometry.coordinates[1]);
      this.#map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 80, maxZoom: 12, duration: 600 },
      );
    }
  }

  #renderMarkers() {
    const map = this.#map;
    const maplibre = this.#maplibre;
    if (!map || !maplibre || !map.getSource('assets')) return;
    const features = map.querySourceFeatures('assets');
    const seen = new Set<string>();
    for (const feature of features) {
      const props = feature.properties as Record<string, unknown>;
      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
      const key = props.cluster ? `c${props.cluster_id}` : String(props.id);
      if (seen.has(key)) continue;
      seen.add(key);
      let marker = this.#markers.get(key);
      if (!marker) {
        const el = document.createElement('button');
        el.type = 'button';
        if (props.cluster) {
          const count = Number(props.point_count);
          const size = Math.round(34 + Math.min(30, Math.log2(count) * 6));
          el.className = 'cluster';
          el.style.width = el.style.height = `${size}px`;
          el.textContent = String(props.point_count_abbreviated ?? count);
          el.setAttribute('aria-label', this.t('results.count', { count }));
          el.addEventListener('click', async () => {
            const source = map.getSource('assets') as GeoJSONSource;
            const zoom = await source.getClusterExpansionZoom(Number(props.cluster_id));
            map.easeTo({ center: coords, zoom });
          });
        } else {
          el.className = 'marker';
          el.style.backgroundImage = `url("${String(props.thumbnail).replace(/"/g, '%22')}")`;
          el.setAttribute('aria-label', String(props.title));
          el.title = String(props.title);
          el.addEventListener('click', () => {
            const { router } = this.services;
            const loc = router.location;
            const qs = loc.query.toString();
            router.navigate(this.href(`/bild/${encodeURIComponent(String(props.id))}`), {
              state: { overlayOf: loc.path + (qs ? `?${qs}` : '') },
            });
          });
        }
        // Marker liegen im Shadow DOM der Seite – Stile greifen dort.
        marker = new maplibre.Marker({ element: el }).setLngLat(coords).addTo(map);
        this.#markers.set(key, marker);
      } else {
        marker.setLngLat(coords);
      }
    }
    for (const [key, marker] of this.#markers) {
      if (!seen.has(key)) {
        marker.remove();
        this.#markers.delete(key);
      }
    }
  }

  #searchArea() {
    const map = this.#map;
    if (!map) return;
    const b = map.getBounds();
    this.services.search.update({
      geo: { north: b.getNorth(), west: b.getWest(), south: b.getSouth(), east: b.getEast() },
    });
  }

  override render() {
    const { search } = this.services;
    const { results, view, query } = search.state;
    return html`<div class="layout">
      <div class="mapwrap">
        <div class="map"></div>
        ${this.failed ? html`<div class="error">${this.t('map.unavailable')}</div>` : nothing}
        <div class="bar">
          <span class="pill">
            ${this.loadingMarkers ? html`<wa-spinner></wa-spinner>` : html`<wa-icon name="map-pin"></wa-icon>`}
            <strong>${this.features.length}</strong>
          </span>
          ${this.limited ? html`<span class="pill">${this.t('map.limit', { count: this.features.length })}</span>` : nothing}
          ${
            !this.loadingMarkers && !this.features.length && results.ready
              ? html`<span class="pill">${this.t('map.noCoordinates')}</span>`
              : nothing
          }
        </div>
        <div class="hint">
          <wa-button
            variant="brand"
            appearance=${query.geo ? 'filled' : 'accent'}
            pill
            @click=${this.#searchArea}
          >
            <wa-icon slot="start" name="scan-search"></wa-icon>${this.t('map.searchArea')}
          </wa-button>
        </div>
      </div>
      <aside aria-label=${this.t('nav.search')}>
        <h1>${this.t('map.title')}</h1>
        <p class="count">${this.t('results.count', { count: results.total })}</p>
        <ep-active-filters></ep-active-filters>
        <ep-results
          .items=${results.items}
          view=${view === 'list' ? 'grid' : 'justified'}
          size="130"
          ?loading=${results.loading}
          ?loadingMore=${results.loadingMore}
          ?hasMore=${!!results.cursor}
          @ep-load-more=${() => search.loadMore()}
        ></ep-results>
      </aside>
    </div>`;
  }
}

customElements.define('ep-map-page', EpMapPage);
