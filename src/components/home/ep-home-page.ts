import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { emptySearchState } from '../../state/search-state.ts';
import { categories } from '../../data/categories.ts';
import type { Asset, CategoryNode } from '../../data/model.ts';
import { justify } from '../results/layout.ts';
import '../search/ep-search-bar.ts';
import '../collections/ep-collection-card.ts';

/** Startseite: Hero mit Suche und Bildcollage, Kennzahlen, Sammlungen, Entdecken-Streifen. */
export class EpHomePage extends EpElement {
  static override properties = {
    hero: { state: true },
    collections: { state: true },
    strips: { state: true },
    width: { state: true },
  };

  declare hero: Asset[];
  declare collections: CategoryNode[];
  declare strips: Array<{ query: string; items: Asset[]; total: number }>;
  declare width: number;

  #resize = new ResizeObserver((entries) => (this.width = entries[0].contentRect.width));
  #unsubscribe?: () => void;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
      }
      .wrap {
        max-width: var(--ep-max);
        margin: 0 auto;
        padding: 0 var(--ep-gutter);
      }
      .hero {
        display: grid;
        grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
        gap: clamp(2rem, 5vw, 5rem);
        align-items: center;
        min-height: calc(100dvh - var(--ep-header-h) - 2rem);
        padding: clamp(2rem, 6vw, 4rem) 0 clamp(3rem, 6vw, 5rem);
      }
      .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 0.6rem;
        margin: 0 0 1.5rem;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--ep-muted);
      }
      .eyebrow::before {
        content: '';
        width: 2rem;
        height: 1px;
        background: currentColor;
      }
      h1 {
        margin: 0;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: var(--ep-display-l);
        line-height: 0.95;
        letter-spacing: -0.025em;
        text-wrap: balance;
      }
      h1 em {
        font-style: italic;
        color: var(--ep-accent-text);
      }
      .sub {
        margin: 1.5rem 0 2.25rem;
        max-width: 46ch;
        font-size: clamp(1rem, 0.95rem + 0.3vw, 1.2rem);
        line-height: 1.6;
        color: var(--ep-muted);
      }
      ep-search-bar {
        max-width: 40rem;
      }
      .stats {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem 2.75rem;
        margin-top: 2.75rem;
      }
      .stat strong {
        display: block;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: clamp(1.75rem, 1.2rem + 1.5vw, 2.6rem);
        line-height: 1;
        letter-spacing: -0.01em;
      }
      .stat span {
        display: block;
        margin-top: 0.4rem;
        font-size: var(--ep-text-xs);
        color: var(--ep-muted);
        letter-spacing: 0.02em;
      }
      .collage {
        position: relative;
        display: grid;
        grid-template-columns: 1.35fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: clamp(0.6rem, 1.2vw, 1rem);
        height: min(74vh, 46rem);
      }
      .collage a {
        position: relative;
        display: block;
        overflow: hidden;
        border-radius: var(--ep-radius-m);
        background: var(--ep-placeholder);
        animation: rise var(--ep-dur-slow) var(--ep-ease) both;
      }
      .collage a:nth-child(1) {
        grid-row: 1 / 3;
      }
      .collage a:nth-child(2) {
        animation-delay: 90ms;
      }
      .collage a:nth-child(3) {
        animation-delay: 180ms;
      }
      .collage img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 1.2s var(--ep-ease);
      }
      .collage a:hover img {
        transform: scale(1.04);
      }
      .collage figcaption {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 2.5rem 1rem 0.9rem;
        background: linear-gradient(to top, rgb(0 0 0 / 0.6), transparent);
        color: #fff;
        font-size: var(--ep-text-xs);
        line-height: 1.4;
        opacity: 0;
        transition: opacity var(--ep-dur) var(--ep-ease);
      }
      .collage a:hover figcaption,
      .collage a:focus-visible figcaption {
        opacity: 1;
      }
      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(18px);
        }
      }
      section {
        padding: clamp(3rem, 7vw, 6rem) 0 0;
      }
      .section-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: clamp(1.25rem, 2.5vw, 2rem);
      }
      h2 {
        margin: 0;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: var(--ep-display-m);
        line-height: 1;
        letter-spacing: -0.015em;
      }
      .link {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: var(--ep-text-s);
        font-weight: 500;
        color: var(--ep-text);
        text-decoration: none;
        white-space: nowrap;
        padding-bottom: 0.2rem;
        background: linear-gradient(currentColor, currentColor) 0 100% / 100% 1px no-repeat;
        transition: gap var(--ep-dur) var(--ep-ease);
      }
      .link:hover {
        gap: 0.7rem;
      }
      .bento {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-auto-rows: clamp(12rem, 20vw, 17rem);
        gap: clamp(0.75rem, 1.4vw, 1.25rem);
      }
      .bento ep-collection-card:first-child {
        grid-column: span 2;
        grid-row: span 2;
      }
      .strip-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        margin: 2.5rem 0 1rem;
      }
      .strip-head h3 {
        margin: 0;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: clamp(1.5rem, 1.2rem + 1vw, 2.1rem);
      }
      .strip-head h3 em {
        color: var(--ep-muted);
        font-size: 0.6em;
        font-style: normal;
        font-family: var(--ep-font-ui);
        margin-left: 0.5rem;
      }
      .row {
        display: flex;
        gap: 10px;
      }
      .row a {
        flex: none;
        overflow: hidden;
        border-radius: var(--ep-radius-s);
        background: var(--ep-placeholder);
      }
      .row img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 900ms var(--ep-ease);
      }
      .row a:hover img {
        transform: scale(1.05);
      }
      @media (max-width: 1080px) {
        .hero {
          grid-template-columns: 1fr;
          min-height: 0;
        }
        .collage {
          height: 60vh;
        }
        .bento {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 560px) {
        .bento {
          grid-template-columns: 1fr;
        }
        .bento ep-collection-card:first-child {
          grid-column: auto;
          grid-row: span 1;
        }
        .collage {
          height: 52vh;
        }
      }
    `,
  ];

  constructor() {
    super();
    this.hero = [];
    this.collections = [];
    this.strips = [];
    this.width = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.title = this.pick(this.services.config.catalog.title);
    void this.#load();
    this.#unsubscribe = this.services.i18n.subscribe(() => void this.#load());
  }

  protected override firstUpdated(): void {
    const wrap = this.renderRoot.querySelector('.measure');
    if (wrap) this.#resize.observe(wrap);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize.disconnect();
    this.#unsubscribe?.();
  }

  async #load() {
    const { catalog, config } = this.services;
    const home = config.home;
    // Hero: kuratierte Bilder aus der Config, sonst die ersten Treffer der ersten Entdecken-Suche.
    const heroPromise = home.heroAssets.length
      ? catalog.getAssets(home.heroAssets)
      : catalog
          .search({ state: emptySearchState(config.search.defaultSort), pageSize: 24, facetSources: [] })
          .then((page) => page.items);
    const collectionsPromise = home.featuredCategories.length
      ? Promise.all(home.featuredCategories.map((id) => categories.node(id).catch(() => null))).then(
          (nodes) => nodes.filter((n): n is NonNullable<typeof n> => !!n),
        )
      : categories.children(categories.root());
    const stripsPromise = Promise.all(
      home.discoverQueries.map(async (query) => {
        const page = await catalog.search({
          state: { ...emptySearchState(config.search.defaultSort), q: query },
          pageSize: 12,
          facetSources: [],
        });
        return { query, items: page.items, total: page.total };
      }),
    );
    const [hero, collections, strips] = await Promise.allSettled([
      heroPromise,
      collectionsPromise,
      stripsPromise,
    ]);
    if (hero.status === 'fulfilled') {
      const pool = hero.value.filter((a) => a.mediaType === 'image');
      // Hochformat zuerst für die grosse Kachel.
      const tall = pool.find((a) => (a.height ?? 0) > (a.width ?? 0)) ?? pool[0];
      this.hero = [tall, ...pool.filter((a) => a !== tall && (a.width ?? 1) >= (a.height ?? 0))]
        .filter(Boolean)
        .slice(0, 3);
    }
    if (collections.status === 'fulfilled') this.collections = collections.value;
    if (strips.status === 'fulfilled') this.strips = strips.value.filter((s) => s.items.length);
  }

  #strip(strip: { query: string; items: Asset[]; total: number }) {
    const rows = justify(
      strip.items.map((a) => ({ id: a.id, ratio: a.width && a.height ? a.width / a.height : 1.5 })),
      this.width || 1200,
      this.width < 700 ? 140 : 210,
      10,
    );
    const row = rows[0];
    if (!row) return nothing;
    const byId = new Map(strip.items.map((a) => [a.id, a]));
    const href = this.href('/suche', { q: strip.query });
    return html`<div class="strip-head">
        <h3>${strip.query}<em>${this.t('results.count', { count: strip.total })}</em></h3>
        <a class="link" href=${href}>${this.t('home.discoverMore')} <wa-icon name="arrow-right"></wa-icon></a>
      </div>
      <div class="row">
        ${row.items.map((item) => {
          const asset = byId.get(item.id)!;
          return html`<a
            href=${this.href(`/bild/${encodeURIComponent(asset.id)}`)}
            style="width:${item.width}px;height:${row.height}px"
            title=${asset.title}
          >
            <img src=${asset.thumbnail} alt=${asset.title} loading="lazy" />
          </a>`;
        })}
      </div>`;
  }

  override render() {
    const { config } = this.services;
    const home = config.home;
    const title = this.pick(config.catalog.title);
    // Letztes Wort kursiv – typografischer Akzent.
    const words = title.split(' ');
    const last = words.pop();
    return html`
      <div class="wrap">
        <div class="hero">
          <div>
            <p class="eyebrow">${this.pick(config.branding.owner) || this.t('home.eyebrow')}</p>
            <h1>${words.join(' ')} <em>${last}</em></h1>
            ${config.catalog.subtitle ? html`<p class="sub">${this.pick(config.catalog.subtitle)}</p>` : nothing}
            <ep-search-bar hero></ep-search-bar>
            ${
              home.stats.length
                ? html`<div class="stats">
                    ${home.stats.map(
                      (s) =>
                        html`<div class="stat">
                          <strong>${s.value}</strong><span>${this.pick(s.label)}</span>
                        </div>`,
                    )}
                  </div>`
                : nothing
            }
          </div>
          <div class="collage" aria-label=${this.t('home.discover')}>
            ${this.hero.map(
              (asset) =>
                html`<a href=${this.href(`/bild/${encodeURIComponent(asset.id)}`)}>
                  <figure style="margin:0;height:100%">
                    <img src=${asset.thumbnail} alt=${asset.title} />
                    <figcaption>${asset.title}${asset.date ? html`<br />${asset.date}` : nothing}</figcaption>
                  </figure>
                </a>`,
            )}
          </div>
        </div>

        ${
          this.collections.length
            ? html`<section>
                <div class="section-head">
                  <h2>${this.t('home.collections')}</h2>
                  <a class="link" href=${this.href('/sammlungen')}
                    >${this.t('home.collectionsAll')} <wa-icon name="arrow-right"></wa-icon
                  ></a>
                </div>
                <div class="bento">
                  ${this.collections
                    .slice(0, 5)
                    .map(
                      (c, i) => html`<ep-collection-card .node=${c} ?large=${i === 0}></ep-collection-card>`,
                    )}
                </div>
              </section>`
            : nothing
        }

        <section class="measure">
          ${
            this.strips.length
              ? html`<div class="section-head"><h2>${this.t('home.discover')}</h2></div>
                  ${this.strips.map((s) => this.#strip(s))}`
              : nothing
          }
        </section>
      </div>
    `;
  }
}

customElements.define('ep-home-page', EpHomePage);
