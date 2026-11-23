import { css, html, nothing, type PropertyValues } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController, storage } from '../../state/store.ts';
import { activeFilterCount, type ViewMode } from '../../state/search-state.ts';
import { categories } from '../../data/categories.ts';
import type { CategoryInfo, CategoryNode } from '../../data/model.ts';
import { exportCsv } from '../../features/export-csv.ts';
import '../filters/ep-filter-panel.ts';
import '../results/ep-results.ts';
import './ep-active-filters.ts';
import '../compare/ep-compare-dialog.ts';

const PANEL_KEY = 'ep-filters-visible';

/** Such- und Sammlungsseite: Kopf, Werkzeugleiste, Filterspalte, Treffer, Auswahlleiste. */
export class EpSearchPage extends EpElement {
  static override properties = {
    collectionId: { attribute: false },
    panel: { state: true },
    drawer: { state: true },
    selecting: { state: true },
    selected: { state: true },
    collection: { state: true },
    collectionPath: { state: true },
    subcollections: { state: true },
    exporting: { state: true },
    comparing: { state: true },
    narrow: { state: true },
  };

  declare collectionId?: string;
  declare panel: boolean;
  declare drawer: boolean;
  declare selecting: boolean;
  declare selected: Set<string>;
  declare collection?: CategoryInfo;
  declare collectionPath: CategoryNode[];
  declare subcollections: CategoryNode[];
  declare exporting: string;
  declare comparing: boolean;
  declare narrow: boolean;

  #media = window.matchMedia('(max-width: 1023px)');
  #onMedia = () => (this.narrow = this.#media.matches);
  #restored = false;
  #lastAnchor = '';

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
        --ep-toolbar-h: 3.75rem;
      }
      .wrap {
        max-width: var(--ep-max);
        margin: 0 auto;
        padding: 0 var(--ep-gutter);
      }
      .intro {
        padding: clamp(2rem, 5vw, 3.75rem) 0 clamp(1.25rem, 3vw, 2rem);
      }
      .eyebrow {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.35rem;
        margin: 0 0 0.75rem;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ep-muted);
      }
      .eyebrow a {
        color: inherit;
        text-decoration: none;
      }
      .eyebrow a:hover {
        color: var(--ep-text);
      }
      .eyebrow wa-icon {
        font-size: 0.75rem;
      }
      h1 {
        margin: 0;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: var(--ep-display-m);
        line-height: 1.02;
        letter-spacing: -0.015em;
        max-width: 22ch;
        text-wrap: balance;
      }
      h1 .q {
        font-style: italic;
      }
      .lead {
        margin: 1rem 0 0;
        max-width: 62ch;
        font-size: var(--ep-text-l);
        line-height: 1.6;
        color: var(--ep-muted);
      }
      .subs {
        display: flex;
        gap: 0.6rem;
        margin-top: 1.5rem;
        overflow-x: auto;
        scrollbar-width: none;
        padding-bottom: 0.25rem;
      }
      .sub {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-shrink: 0;
        padding: 0.35rem 1rem 0.35rem 0.35rem;
        border-radius: 999px;
        border: 1px solid var(--ep-border);
        background: var(--ep-surface);
        color: var(--ep-text);
        text-decoration: none;
        font-size: var(--ep-text-s);
        font-weight: 500;
        transition:
          border-color var(--ep-dur-fast),
          transform var(--ep-dur) var(--ep-ease);
      }
      .sub:hover {
        border-color: var(--ep-border-strong);
        transform: translateY(-1px);
      }
      .sub img,
      .sub .ph {
        width: 2.2rem;
        height: 2.2rem;
        border-radius: 50%;
        object-fit: cover;
        background: var(--ep-placeholder);
      }
      .toolbar {
        position: sticky;
        top: var(--ep-header-h);
        z-index: 40;
        background: var(--ep-glass);
        backdrop-filter: blur(18px) saturate(1.5);
        -webkit-backdrop-filter: blur(18px) saturate(1.5);
        border-bottom: 1px solid var(--ep-border);
      }
      .toolbar .wrap {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-height: var(--ep-toolbar-h);
      }
      .count {
        font-size: var(--ep-text-s);
        color: var(--ep-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .count strong {
        color: var(--ep-text);
        font-weight: 600;
      }
      .grow {
        flex: 1;
      }
      .views {
        display: inline-flex;
        padding: 0.18rem;
        border-radius: 999px;
        background: var(--ep-lowered);
      }
      .views button {
        display: grid;
        place-items: center;
        width: 2rem;
        height: 1.75rem;
        border: 0;
        border-radius: 999px;
        background: none;
        color: var(--ep-muted);
        cursor: pointer;
        transition: all var(--ep-dur-fast);
      }
      .views button[aria-pressed='true'] {
        background: var(--ep-surface);
        color: var(--ep-text);
        box-shadow: var(--ep-shadow-s);
      }
      .size {
        width: 7rem;
      }
      wa-select.sort {
        width: 11.5rem;
      }
      .layout {
        display: grid;
        grid-template-columns: 17rem minmax(0, 1fr);
        gap: clamp(1.5rem, 3vw, 3rem);
        padding-top: 1.5rem;
      }
      .layout.no-panel {
        grid-template-columns: minmax(0, 1fr);
      }
      aside {
        position: sticky;
        top: calc(var(--ep-header-h) + var(--ep-toolbar-h) + 1rem);
        align-self: start;
        max-height: calc(100dvh - var(--ep-header-h) - var(--ep-toolbar-h) - 2rem);
        overflow: auto;
        scrollbar-width: thin;
        padding-right: 0.25rem;
      }
      .active {
        margin-bottom: 1.25rem;
      }
      .state {
        display: grid;
        justify-items: center;
        gap: 0.75rem;
        padding: 12vh 1rem;
        text-align: center;
      }
      .state h2 {
        margin: 0.5rem 0 0;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: var(--ep-display-s);
      }
      .state p {
        margin: 0;
        color: var(--ep-muted);
        max-width: 42ch;
      }
      .state .icon {
        font-size: 2.25rem;
        color: var(--ep-muted);
      }
      .selbar {
        position: fixed;
        left: 50%;
        bottom: max(1.25rem, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        z-index: 70;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.45rem 0.45rem 0.45rem 1.1rem;
        border-radius: 999px;
        background: var(--ep-text);
        color: var(--ep-bg);
        box-shadow: var(--ep-shadow-l);
        animation: rise var(--ep-dur) var(--ep-ease);
        max-width: calc(100vw - 2rem);
        overflow-x: auto;
      }
      .selbar .n {
        font-size: var(--ep-text-s);
        font-weight: 600;
        white-space: nowrap;
      }
      .selbar .link {
        border: 0;
        background: none;
        color: inherit;
        opacity: 0.7;
        font-size: var(--ep-text-xs);
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
        white-space: nowrap;
      }
      .selbar .sep {
        width: 1px;
        height: 1.4rem;
        background: currentColor;
        opacity: 0.2;
      }
      .selbar button.act {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        height: 2.25rem;
        padding: 0 0.95rem;
        border: 0;
        border-radius: 999px;
        background: rgb(255 255 255 / 0.12);
        color: inherit;
        font: inherit;
        font-size: var(--ep-text-s);
        font-weight: 500;
        cursor: pointer;
        white-space: nowrap;
      }
      :host-context(.wa-light) .selbar button.act {
        background: rgb(255 255 255 / 0.14);
      }
      .selbar button.act:hover:not(:disabled) {
        background: var(--ep-accent);
        color: var(--ep-accent-on);
      }
      .selbar button.act:disabled {
        opacity: 0.4;
        cursor: default;
      }
      .selbar button.done {
        background: var(--ep-bg);
        color: var(--ep-text);
      }
      @keyframes rise {
        from {
          opacity: 0;
          transform: translate(-50%, 12px);
        }
      }
      @media (max-width: 1023px) {
        .layout {
          grid-template-columns: minmax(0, 1fr);
        }
        .hide-narrow {
          display: none;
        }
      }
      @media (max-width: 640px) {
        .count .for {
          display: none;
        }
        wa-select.sort {
          width: 9rem;
        }
      }
    `,
  ];

  constructor() {
    super();
    this.panel = storage.get<boolean>(PANEL_KEY, true);
    this.drawer = false;
    this.selecting = false;
    this.selected = new Set();
    this.collectionPath = [];
    this.subcollections = [];
    this.exporting = '';
    this.comparing = false;
    this.narrow = this.#media.matches;
    new StoreController(this, this.services.search);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#media.addEventListener('change', this.#onMedia);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#media.removeEventListener('change', this.#onMedia);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('collectionId')) void this.#loadCollection();
  }

  protected override updated(): void {
    // Scrollposition nach «Zurück» wiederherstellen, sobald die Treffer da sind.
    const { results } = this.services.search.state;
    const loc = this.services.router.location;
    const anchor = loc.path + loc.query.toString();
    if (anchor !== this.#lastAnchor) {
      this.#lastAnchor = anchor;
      this.#restored = false;
    }
    if (!this.#restored && results.ready && !results.loading) {
      this.#restored = true;
      const y = loc.state.scrollY;
      if (y !== undefined && loc.route.name !== 'asset')
        requestAnimationFrame(() => window.scrollTo({ top: y }));
    }
    document.title = this.#title();
  }

  #title(): string {
    const { search, config } = this.services;
    const base = this.pick(config.branding.name);
    if (this.collection) return `${this.collection.name} – ${base}`;
    const q = search.state.query.q;
    return q ? `«${q}» – ${base}` : `${this.t('nav.search')} – ${base}`;
  }

  async #loadCollection() {
    const id = this.collectionId;
    this.collection = undefined;
    this.subcollections = [];
    this.collectionPath = [];
    if (!id) return;
    try {
      const [node, path, children] = await Promise.all([
        categories.node(id),
        categories.path(id),
        categories.children(id),
      ]);
      if (id !== this.collectionId) return;
      this.collection = node;
      this.collectionPath = path.filter((p) => p.id !== categories.root() && p.id !== id);
      this.subcollections = children;
    } catch {
      /* Kopf bleibt schlicht */
    }
  }

  #togglePanel() {
    if (this.narrow) {
      this.drawer = true;
      return;
    }
    this.panel = !this.panel;
    storage.set(PANEL_KEY, this.panel);
  }

  #onSelect(event: CustomEvent<{ id: string; selected: boolean }>) {
    const next = new Set(this.selected);
    if (event.detail.selected) next.add(event.detail.id);
    else next.delete(event.detail.id);
    this.selected = next;
  }

  #endSelection() {
    this.selecting = false;
    this.selected = new Set();
  }

  #addSelectedToBasket() {
    const { search, basket, toast } = this.services;
    const assets = search.state.results.items.filter((a) => this.selected.has(a.id));
    const added = basket.add(assets);
    if (added < assets.length && basket.count >= basket.max) {
      toast.show(this.t('basket.max', { max: basket.max }), { variant: 'danger', icon: 'warning' });
    }
    if (added) toast.show(this.t('basket.addedMany', { count: added }), { icon: 'bookmark-check' });
    this.#endSelection();
  }

  async #export() {
    const ids = [...this.selected];
    try {
      const count = await exportCsv(
        ids,
        (done, total) => (this.exporting = this.t('export.loading', { done, total })),
      );
      this.services.toast.show(this.t('export.done', { count }), { icon: 'csv' });
    } finally {
      this.exporting = '';
    }
  }

  #intro() {
    const { search, config } = this.services;
    const q = search.state.query.q;
    if (this.collectionId) {
      const name = this.collection?.name ?? '';
      return html`<header class="intro">
        <nav class="eyebrow" aria-label="Breadcrumb">
          <a href=${this.href('/sammlungen')}>${this.t('nav.collections')}</a>
          ${this.collectionPath.map(
            (p) =>
              html`<wa-icon name="chevron-right"></wa-icon>
                <a href=${this.href(`/sammlung/${encodeURIComponent(p.id)}`)}>${p.name}</a>`,
          )}
        </nav>
        <h1>${name || html`&nbsp;`}</h1>
        ${this.collection?.description ? html`<p class="lead">${this.collection.description}</p>` : nothing}
        ${
          this.subcollections.length
            ? html`<div class="subs" role="list" aria-label=${this.t('collection.sub')}>
                ${this.subcollections.map(
                  (sub) =>
                    html`<a
                      role="listitem"
                      class="sub"
                      href=${this.href(`/sammlung/${encodeURIComponent(sub.id)}`)}
                    >
                      ${sub.thumbnail ? html`<img src=${sub.thumbnail} alt="" loading="lazy" />` : html`<span class="ph"></span>`}
                      ${sub.name}
                    </a>`,
                )}
              </div>`
            : nothing
        }
      </header>`;
    }
    return html`<header class="intro">
      <p class="eyebrow">${this.pick(config.catalog.title)}</p>
      <h1>${q ? html`<span class="q">«${q}»</span>` : this.t('nav.search')}</h1>
    </header>`;
  }

  #toolbar() {
    const { search, config } = this.services;
    const { results, query, view, size } = search.state;
    const filters = activeFilterCount(query) - (this.collectionId ? 1 : 0);
    const sortOptions = config.search.sortOptions;
    const views: Array<[ViewMode, string]> = [
      ['justified', 'justified'],
      ['grid', 'grid'],
      ['list', 'list'],
    ];
    return html`<div class="toolbar">
      <div class="wrap">
        <wa-button
          size="s"
          appearance=${this.panel && !this.narrow ? 'filled' : 'outlined'}
          @click=${this.#togglePanel}
          aria-expanded=${this.narrow ? String(this.drawer) : String(this.panel)}
        >
          <wa-icon slot="start" name="sliders"></wa-icon>
          ${filters > 0 ? this.t('results.filtersCount', { count: filters }) : this.t('results.filters')}
        </wa-button>
        <span class="count" role="status" aria-live="polite">
          ${
            results.loading && !results.ready
              ? this.t('results.loading')
              : html`<strong>${this.t('results.count', { count: results.total })}</strong>`
          }
        </span>
        <span class="grow"></span>
        ${
          sortOptions.length > 1
            ? html`<wa-select
                class="sort sr-label"
                size="s"
                .value=${query.sort}
                label=${this.t('results.sort')}
                @change=${(e: Event) => search.update({ sort: (e.target as HTMLSelectElement).value })}
              >
                <wa-icon slot="start" name="arrow-down"></wa-icon>
                ${sortOptions.map((o) => html`<wa-option value=${o.id}>${this.pick(o.label)}</wa-option>`)}
              </wa-select>`
            : nothing
        }
        ${
          view !== 'list'
            ? html`<wa-slider
                class="size hide-narrow sr-label"
                label=${this.t('results.size')}
                min="140"
                max="360"
                step="10"
                .value=${size}
                @input=${(e: Event) => search.setSize(Number((e.target as HTMLInputElement).value))}
              ></wa-slider>`
            : nothing
        }
        <div class="views" role="group" aria-label=${this.t('results.view')}>
          ${views.map(
            ([mode, icon]) =>
              html`<button
                type="button"
                aria-pressed=${view === mode ? 'true' : 'false'}
                title=${this.t(`results.view.${mode}`)}
                aria-label=${this.t(`results.view.${mode}`)}
                @click=${() => search.setView(mode)}
              >
                <wa-icon name=${icon}></wa-icon>
              </button>`,
          )}
        </div>
        <wa-button
          class="hide-narrow"
          size="s"
          appearance=${this.selecting ? 'filled' : 'plain'}
          @click=${() => (this.selecting ? this.#endSelection() : (this.selecting = true))}
        >
          <wa-icon slot="start" name="square-check"></wa-icon>${this.t('results.select')}
        </wa-button>
      </div>
    </div>`;
  }

  #body() {
    const { search } = this.services;
    const { results, view, size } = search.state;
    if (results.error) {
      return html`<div class="state">
        <wa-icon class="icon" name="warning"></wa-icon>
        <h2>${this.t('app.error.title')}</h2>
        <p>${this.t('app.error.network')}</p>
        <wa-button variant="brand" pill @click=${() => search.refresh()}
          >${this.t('app.error.retry')}</wa-button
        >
      </div>`;
    }
    if (results.ready && !results.loading && !results.items.length) {
      return html`<div class="state">
        <wa-icon class="icon" name="scan-search"></wa-icon>
        <h2>${this.t('results.empty.title')}</h2>
        <p>${this.t('results.empty.text')}</p>
        ${
          activeFilterCount(search.state.query) || search.state.query.q
            ? html`<wa-button appearance="outlined" pill @click=${() => search.reset()}
                >${this.t('filters.reset')}</wa-button
              >`
            : nothing
        }
      </div>`;
    }
    return html`<ep-results
      .items=${results.items}
      view=${view}
      size=${size}
      ?loading=${results.loading}
      ?loadingMore=${results.loadingMore}
      ?hasMore=${!!results.cursor}
      ?selecting=${this.selecting}
      .selected=${this.selected}
      @ep-load-more=${() => search.loadMore()}
      @ep-select=${this.#onSelect}
    ></ep-results>`;
  }

  #selectionBar() {
    if (!this.selecting) return nothing;
    const { search, config } = this.services;
    const n = this.selected.size;
    return html`<div class="selbar" role="toolbar" aria-label=${this.t('results.select')}>
      <span class="n" aria-live="polite">${this.t('results.selected', { count: n })}</span>
      <button
        type="button"
        class="link"
        @click=${() => (this.selected = new Set(search.state.results.items.map((a) => a.id)))}
      >
        ${this.t('results.selectAll')}
      </button>
      <button type="button" class="link" @click=${() => (this.selected = new Set())}>
        ${this.t('results.selectNone')}
      </button>
      <span class="sep"></span>
      ${
        config.basket.enabled
          ? html`<button type="button" class="act" ?disabled=${!n} @click=${this.#addSelectedToBasket}>
              <wa-icon name="bookmark-plus"></wa-icon>${this.t('results.addSelected')}
            </button>`
          : nothing
      }
      ${
        config.compare.enabled
          ? html`<button
              type="button"
              class="act"
              ?disabled=${n !== 2}
              title=${this.t('compare.hint')}
              @click=${() => (this.comparing = true)}
            >
              <wa-icon name="compare"></wa-icon>${this.t('results.compare')}
            </button>`
          : nothing
      }
      <button type="button" class="act" ?disabled=${!n || !!this.exporting} @click=${this.#export}>
        <wa-icon name="csv"></wa-icon>${this.exporting || this.t('results.exportCsv')}
      </button>
      <button type="button" class="act done" @click=${this.#endSelection}>
        ${this.t('results.selectDone')}
      </button>
    </div>`;
  }

  override render() {
    const showPanel = this.panel && !this.narrow;
    return html`
      <div class="wrap">${this.#intro()}</div>
      ${this.#toolbar()}
      <div class="wrap">
        <div class="layout ${showPanel ? '' : 'no-panel'}">
          ${showPanel ? html`<aside aria-label=${this.t('filters.title')}><ep-filter-panel></ep-filter-panel></aside>` : nothing}
          <section aria-label=${this.t('nav.search')}>
            <div class="active"><ep-active-filters></ep-active-filters></div>
            ${this.#body()}
          </section>
        </div>
      </div>
      ${
        this.narrow
          ? html`<wa-drawer
              placement="start"
              label=${this.t('filters.title')}
              ?open=${this.drawer}
              @wa-after-hide=${(e: Event) => e.target === e.currentTarget && (this.drawer = false)}
            >
              ${this.drawer ? html`<ep-filter-panel></ep-filter-panel>` : nothing}
              <wa-button
                slot="footer"
                variant="brand"
                pill
                style="width:100%"
                @click=${() => (this.drawer = false)}
              >
                ${this.t('results.count', { count: this.services.search.state.results.total })}
              </wa-button>
            </wa-drawer>`
          : nothing
      }
      ${this.#selectionBar()}
      ${
        this.comparing
          ? html`<ep-compare-dialog
              .ids=${[...this.selected]}
              @ep-close=${() => (this.comparing = false)}
            ></ep-compare-dialog>`
          : nothing
      }
    `;
  }
}

customElements.define('ep-search-page', EpSearchPage);
