import { css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { EpElement } from '../../ui/ep-element.ts';
import type { Asset } from '../../data/model.ts';
import type { ViewMode } from '../../state/search-state.ts';
import { justify } from './layout.ts';
import './ep-asset-card.ts';
import './ep-results-table.ts';

/**
 * Trefferdarstellung: Galerie (Justified Grid), Raster oder Liste – inklusive Platzhaltern,
 * Nachladen beim Scrollen und Auswahlmodus.
 */
export class EpResults extends EpElement {
  static override properties = {
    items: { attribute: false },
    view: {},
    size: { type: Number },
    loading: { type: Boolean },
    loadingMore: { type: Boolean },
    hasMore: { type: Boolean },
    selecting: { type: Boolean },
    selected: { attribute: false },
    width: { state: true },
  };

  declare items: Asset[];
  declare view: ViewMode;
  declare size: number;
  declare loading: boolean;
  declare loadingMore: boolean;
  declare hasMore: boolean;
  declare selecting: boolean;
  declare selected: Set<string>;
  declare width: number;

  #resize = new ResizeObserver((entries) => {
    const width = Math.floor(entries[0].contentRect.width);
    if (Math.abs(width - this.width) > 1) this.width = width;
  });
  #sentinel?: IntersectionObserver;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
        --gap: clamp(6px, 0.7vw, 10px);
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: var(--gap);
      }
      .row {
        display: flex;
        gap: var(--gap);
        content-visibility: auto;
      }
      .row > * {
        flex: none;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(var(--tile), 1fr));
        gap: clamp(1rem, 2vw, 1.75rem) clamp(0.75rem, 1.6vw, 1.5rem);
      }
      .grid ep-asset-card {
        content-visibility: auto;
        contain-intrinsic-size: auto 320px;
      }
      .skeleton {
        border-radius: var(--ep-radius-s);
        background: var(--ep-placeholder);
        background-image: linear-gradient(110deg, transparent 30%, var(--ep-hover) 50%, transparent 70%);
        background-size: 250% 100%;
        animation: shimmer 1.6s linear infinite;
      }
      @keyframes shimmer {
        to {
          background-position: -250% 0;
        }
      }
      .more {
        display: flex;
        justify-content: center;
        padding: 2.5rem 0 1rem;
      }
      .more wa-button::part(base),
      .more wa-button::part(button) {
        min-width: 12rem;
      }
      .busy {
        opacity: 0.45;
        transition: opacity var(--ep-dur) var(--ep-ease);
      }
      .appear {
        animation: appear var(--ep-dur-slow) var(--ep-ease) both;
      }
      @keyframes appear {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
      }
    `,
  ];

  constructor() {
    super();
    this.items = [];
    this.view = 'justified';
    this.size = 220;
    this.loading = false;
    this.loadingMore = false;
    this.hasMore = false;
    this.selecting = false;
    this.selected = new Set();
    this.width = 0;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#resize.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#resize.disconnect();
    this.#sentinel?.disconnect();
  }

  protected override updated(): void {
    const sentinel = this.renderRoot.querySelector('.sentinel');
    this.#sentinel?.disconnect();
    if (sentinel && this.hasMore) {
      this.#sentinel = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting) && !this.loadingMore) this.emit('ep-load-more');
        },
        { rootMargin: '900px 0px' },
      );
      this.#sentinel.observe(sentinel);
    }
  }

  #ratio(asset: Asset): number {
    return asset.width && asset.height ? asset.width / asset.height : 1.5;
  }

  #card(asset: Asset, variant: 'fill' | 'tile', style?: Record<string, string>) {
    return html`<ep-asset-card
      .asset=${asset}
      variant=${variant}
      ?selectable=${this.selecting}
      ?selected=${this.selected.has(asset.id)}
      style=${style ? styleMap(style) : nothing}
    ></ep-asset-card>`;
  }

  #skeleton() {
    if (this.view === 'list') {
      return html`<div class="rows">
        ${Array.from({ length: 8 }, () => html`<div class="skeleton" style="height:4.5rem"></div>`)}
      </div>`;
    }
    if (this.view === 'grid') {
      return html`<div class="grid" style=${styleMap({ '--tile': `${this.size}px` })}>
        ${Array.from({ length: 12 }, () => html`<div class="skeleton" style="aspect-ratio:4/3"></div>`)}
      </div>`;
    }
    const pattern = [
      1.5, 0.75, 1.33, 1, 1.78, 0.67, 1.5, 1.25, 2, 0.8, 1.5, 1.33, 1, 1.5, 0.75, 1.6, 1.33, 1,
    ];
    const rows = justify(
      pattern.map((ratio, i) => ({ id: String(i), ratio })),
      this.width,
      this.size,
      10,
    ).slice(0, 4);
    return html`<div class="rows">
      ${rows.map(
        (row) =>
          html`<div class="row">
            ${row.items.map((item) => html`<div class="skeleton" style="width:${item.width}px;height:${row.height}px"></div>`)}
          </div>`,
      )}
    </div>`;
  }

  #justified() {
    const gap = this.width < 700 ? 6 : 10;
    const target = this.width < 560 ? Math.min(this.size, 150) : this.size;
    const byId = new Map(this.items.map((a) => [a.id, a]));
    const rows = justify(
      this.items.map((a) => ({ id: a.id, ratio: this.#ratio(a) })),
      this.width,
      target,
      gap,
    );
    return html`<div class="rows ${this.loading ? 'busy' : ''}" style="--gap:${gap}px">
      ${repeat(
        rows,
        (row) => row.items[0]?.id,
        (row) =>
          html`<div class="row" style="contain-intrinsic-size: auto ${row.height}px; height:${row.height}px">
            ${repeat(
              row.items,
              (item) => item.id,
              (item) =>
                this.#card(byId.get(item.id)!, 'fill', {
                  width: `${item.width}px`,
                  height: `${row.height}px`,
                }),
            )}
          </div>`,
      )}
    </div>`;
  }

  #grid() {
    return html`<div
      class="grid ${this.loading ? 'busy' : ''}"
      style=${styleMap({ '--tile': `${Math.max(160, this.size)}px` })}
    >
      ${repeat(
        this.items,
        (a) => a.id,
        (a) => this.#card(a, 'tile'),
      )}
    </div>`;
  }

  override render() {
    if (this.loading && !this.items.length) return this.#skeleton();
    let body;
    if (this.view === 'list') {
      body = html`<ep-results-table
        class=${this.loading ? 'busy' : ''}
        .items=${this.items}
        ?selecting=${this.selecting}
        .selected=${this.selected}
      ></ep-results-table>`;
    } else if (this.view === 'grid') body = this.#grid();
    else body = this.#justified();
    return html`
      ${body}
      ${
        this.hasMore
          ? html`<div class="more">
              <span class="sentinel"></span>
              <wa-button
                appearance="outlined"
                pill
                ?loading=${this.loadingMore}
                @click=${() => this.emit('ep-load-more')}
              >
                ${this.t('results.loadMore')}
              </wa-button>
            </div>`
          : nothing
      }
    `;
  }
}

customElements.define('ep-results', EpResults);
