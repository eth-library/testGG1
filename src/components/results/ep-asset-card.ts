import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import type { Asset } from '../../data/model.ts';

/**
 * Bildkarte für Trefferlisten. Varianten: `fill` (Justified Grid, Grösse von aussen)
 * und `tile` (Raster mit Bildunterschrift). Öffnet die Detailansicht als Overlay.
 */
export class EpAssetCard extends EpElement {
  static override properties = {
    asset: { attribute: false },
    variant: { reflect: true },
    selectable: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
    loaded: { state: true },
    failed: { state: true },
  };

  declare asset: Asset;
  declare variant: 'fill' | 'tile';
  declare selectable: boolean;
  declare selected: boolean;
  declare loaded: boolean;
  declare failed: boolean;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
        position: relative;
        min-width: 0;
      }
      .card {
        position: relative;
        display: block;
        height: 100%;
        color: inherit;
        text-decoration: none;
        border-radius: var(--ep-radius-s);
        outline-offset: 3px;
      }
      .frame {
        position: relative;
        overflow: hidden;
        width: 100%;
        height: 100%;
        border-radius: var(--ep-radius-s);
        background: var(--ep-placeholder);
        isolation: isolate;
      }
      :host([variant='tile']) .frame {
        height: auto;
        aspect-ratio: 4 / 3;
        background: var(--ep-lowered);
      }
      .frame::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(110deg, transparent 30%, var(--ep-hover) 50%, transparent 70%) 0 0 / 250%
          100%;
        animation: shimmer 1.6s linear infinite;
        opacity: 0.8;
      }
      :host([data-loaded]) .frame::before {
        display: none;
      }
      @keyframes shimmer {
        to {
          background-position: -250% 0;
        }
      }
      img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transform: scale(1.015);
        transition:
          opacity var(--ep-dur-slow) var(--ep-ease),
          transform 900ms var(--ep-ease),
          filter var(--ep-dur) var(--ep-ease);
      }
      :host([variant='tile']) img {
        object-fit: contain;
        padding: 6%;
      }
      :host([data-loaded]) img {
        opacity: 1;
        transform: none;
      }
      .card:hover img,
      .card:focus-visible img {
        transform: scale(1.035);
      }
      :host([variant='tile']) .card:hover img {
        transform: scale(1.02);
      }
      .failed {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: var(--ep-muted);
        font-size: 1.5rem;
      }
      .overlay {
        position: absolute;
        inset: auto 0 0 0;
        padding: 2.4rem 0.85rem 0.75rem;
        background: linear-gradient(to top, rgb(0 0 0 / 0.72), rgb(0 0 0 / 0.38) 55%, transparent);
        color: #fff;
        opacity: 0;
        transform: translateY(6px);
        transition:
          opacity var(--ep-dur) var(--ep-ease),
          transform var(--ep-dur) var(--ep-ease);
        pointer-events: none;
      }
      .card:hover .overlay,
      .card:focus-visible .overlay {
        opacity: 1;
        transform: none;
      }
      .overlay .title {
        font-size: var(--ep-text-s);
        font-weight: 500;
        line-height: 1.3;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .overlay .meta {
        margin-top: 0.2rem;
        font-size: var(--ep-text-xs);
        opacity: 0.78;
        font-variant-numeric: tabular-nums;
      }
      .caption {
        padding: 0.7rem 0.15rem 0.2rem;
      }
      .caption .title {
        font-size: var(--ep-text-s);
        font-weight: 500;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .caption .meta {
        margin-top: 0.25rem;
        font-size: var(--ep-text-xs);
        color: var(--ep-muted);
        font-variant-numeric: tabular-nums;
      }
      .actions {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        display: flex;
        gap: 0.35rem;
        z-index: 2;
        opacity: 0;
        transform: translateY(-4px);
        transition:
          opacity var(--ep-dur) var(--ep-ease),
          transform var(--ep-dur) var(--ep-ease);
      }
      :host(:hover) .actions,
      :host(:focus-within) .actions,
      .actions.pinned {
        opacity: 1;
        transform: none;
      }
      .action {
        display: grid;
        place-items: center;
        width: 2.1rem;
        height: 2.1rem;
        border: 0;
        border-radius: 50%;
        background: rgb(255 255 255 / 0.92);
        color: #141414;
        box-shadow: 0 2px 10px rgb(0 0 0 / 0.18);
        cursor: pointer;
        backdrop-filter: blur(8px);
        transition:
          transform var(--ep-dur-fast) var(--ep-ease),
          background var(--ep-dur-fast);
      }
      .action:hover {
        transform: scale(1.08);
      }
      .action[aria-pressed='true'] {
        background: var(--ep-accent);
        color: var(--ep-accent-on);
      }
      .action wa-icon {
        font-size: 1rem;
      }
      .check {
        position: absolute;
        top: 0.55rem;
        left: 0.55rem;
        z-index: 2;
        display: grid;
        place-items: center;
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 50%;
        border: 2px solid #fff;
        background: rgb(0 0 0 / 0.25);
        color: transparent;
        box-shadow: 0 1px 6px rgb(0 0 0 / 0.3);
        pointer-events: none;
        transition: all var(--ep-dur-fast);
      }
      :host([selected]) .check {
        background: var(--ep-accent);
        border-color: var(--ep-accent);
        color: var(--ep-accent-on);
      }
      :host([selected]) .frame {
        outline: 3px solid var(--ep-accent);
        outline-offset: 2px;
      }
      :host([selectable]) .frame::after {
        content: '';
        position: absolute;
        inset: 0;
        background: rgb(0 0 0 / 0.12);
        opacity: 0;
        transition: opacity var(--ep-dur-fast);
      }
      :host([selectable]:hover) .frame::after {
        opacity: 1;
      }
      .badge {
        position: absolute;
        left: 0.55rem;
        bottom: 0.55rem;
        z-index: 1;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.2rem 0.5rem;
        border-radius: 999px;
        font-size: 0.66rem;
        font-weight: 600;
        letter-spacing: 0.03em;
        background: rgb(0 0 0 / 0.55);
        color: #fff;
        backdrop-filter: blur(6px);
      }
      :host([selectable]) .actions {
        display: none;
      }
    `,
  ];

  constructor() {
    super();
    this.variant = 'fill';
    this.selectable = false;
    this.selected = false;
    this.loaded = false;
    this.failed = false;
    new StoreController(this, this.services.basket);
  }

  protected override willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('asset') && changed.get('asset')) {
      const previous = changed.get('asset') as Asset;
      if (previous.thumbnail !== this.asset.thumbnail) {
        this.loaded = false;
        this.failed = false;
      }
    }
    this.toggleAttribute('data-loaded', this.loaded);
  }

  #onClick(event: MouseEvent) {
    if (this.selectable) {
      event.preventDefault();
      this.emit('ep-select', { id: this.asset.id, selected: !this.selected, shift: event.shiftKey });
      return;
    }
    // Shared-Element-Übergang zur Detailansicht vorbereiten.
    const img = this.renderRoot.querySelector('img');
    if (img && !event.metaKey && !event.ctrlKey) {
      document.querySelectorAll('[data-vt-source]').forEach((el) => el.removeAttribute('data-vt-source'));
      img.style.viewTransitionName = 'ep-hero-image';
      setTimeout(() => (img.style.viewTransitionName = ''), 900);
    }
  }

  #toggleBasket(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    const { basket, toast } = this.services;
    if (!basket.has(this.asset.id) && basket.count >= basket.max) {
      toast.show(this.t('basket.max', { max: basket.max }), { variant: 'danger', icon: 'warning' });
      return;
    }
    const added = basket.toggle(this.asset);
    if (added)
      toast.show(this.t('basket.added', { title: this.asset.title || this.t('common.untitled') }), {
        icon: 'bookmark-check',
      });
  }

  override render() {
    const asset = this.asset;
    if (!asset) return nothing;
    const title = asset.title || this.t('common.untitled');
    const inBasket = this.services.basket.has(asset.id);
    const basketEnabled = this.services.config.basket.enabled;
    const meta = [asset.date, asset.fields[this.services.config.fields.creator ?? '']?.[0]?.label]
      .filter(Boolean)
      .join(' · ');
    return html`
      <a
        class="card"
        href=${this.href(`/bild/${encodeURIComponent(asset.id)}`)}
        data-overlay="true"
        aria-label=${title}
        @click=${this.#onClick}
        role=${this.selectable ? 'checkbox' : nothing}
        aria-checked=${this.selectable ? String(this.selected) : nothing}
      >
        <div class="frame">
          ${
            this.failed
              ? html`<div class="failed"><wa-icon name="image-off"></wa-icon></div>`
              : html`<img
                  src=${asset.thumbnail}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable="false"
                  @load=${() => (this.loaded = true)}
                  @error=${() => ((this.failed = true), (this.loaded = true))}
                />`
          }
          ${
            !asset.downloadable
              ? html`<span class="badge"><wa-icon name="lock"></wa-icon>${this.t('basket.restricted')}</span>`
              : nothing
          }
          ${
            this.variant === 'fill'
              ? html`<div class="overlay" aria-hidden="true">
                  <div class="title">${title}</div>
                  ${meta ? html`<div class="meta">${meta}</div>` : nothing}
                </div>`
              : nothing
          }
        </div>
        ${
          this.variant === 'tile'
            ? html`<div class="caption">
                <div class="title">${title}</div>
                ${meta ? html`<div class="meta">${meta}</div>` : nothing}
              </div>`
            : nothing
        }
      </a>
      ${this.selectable ? html`<span class="check" aria-hidden="true"><wa-icon name="check"></wa-icon></span>` : nothing}
      ${
        basketEnabled
          ? html`<div class="actions ${inBasket ? 'pinned' : ''}">
              <button
                type="button"
                class="action"
                aria-pressed=${inBasket ? 'true' : 'false'}
                aria-label=${inBasket ? this.t('detail.removeFromBasket') : this.t('detail.addToBasket')}
                title=${inBasket ? this.t('detail.removeFromBasket') : this.t('detail.addToBasket')}
                @click=${this.#toggleBasket}
              >
                <wa-icon name=${inBasket ? 'bookmark-check' : 'bookmark-plus'}></wa-icon>
              </button>
            </div>`
          : nothing
      }
    `;
  }
}

customElements.define('ep-asset-card', EpAssetCard);
