import { css, html, nothing, type PropertyValues } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController, storage } from '../../state/store.ts';
import type { Asset, AssetDetail, RelationType } from '../../data/model.ts';
import './ep-asset-info.ts';
import './ep-zoom.ts';

const INFO_KEY = 'ep-viewer-info';

/**
 * Detailansicht. `mode="overlay"`: Lightbox über der Trefferliste (Blättern, Diashow);
 * `mode="page"`: eigenständige Seite für Direktaufrufe/Permalinks.
 */
export class EpAssetViewer extends EpElement {
  static override properties = {
    assetId: { attribute: false },
    mode: { reflect: true },
    asset: { state: true },
    related: { state: true },
    error: { state: true },
    info: { state: true },
    zooming: { state: true },
    zoomUrl: { state: true },
    playing: { state: true },
    previewLoaded: { state: true },
  };

  declare assetId: string;
  declare mode: 'overlay' | 'page';
  declare asset?: AssetDetail;
  declare related: Array<{ type: RelationType; assets: Asset[] }>;
  declare error: boolean;
  declare info: boolean;
  declare zooming: boolean;
  declare zoomUrl?: string;
  declare playing: boolean;
  declare previewLoaded: boolean;

  #loadedFor = '';
  #timer?: number;
  #touchX?: number;
  #returnFocus?: Element | null;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
        --panel: min(27rem, 36vw);
        color-scheme: dark;
      }
      :host([mode='overlay']) {
        position: fixed;
        inset: 0;
        z-index: 100;
        animation: fade var(--ep-dur) var(--ep-ease);
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
      .viewer {
        position: relative;
        display: grid;
        grid-template-columns: minmax(0, 1fr) var(--panel);
        height: 100%;
        background: #0b0b0c;
        outline: none;
      }
      :host([mode='page']) .viewer {
        height: calc(100dvh - var(--ep-header-h));
        min-height: 32rem;
      }
      .viewer.no-info {
        grid-template-columns: minmax(0, 1fr) 0;
      }
      .stage {
        position: relative;
        min-width: 0;
        overflow: hidden;
        user-select: none;
      }
      .image {
        position: absolute;
        inset: 4.5rem 4.5rem 4rem;
        display: grid;
        place-items: center;
      }
      .image img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        box-shadow: 0 30px 80px -20px rgb(0 0 0 / 0.7);
        view-transition-name: ep-hero-image;
        transition: opacity var(--ep-dur-slow) var(--ep-ease);
      }
      .image img.preview {
        position: absolute;
        inset: 0;
        margin: auto;
      }
      .image img.thumb {
        filter: blur(0.4px);
      }
      .image img.hidden {
        opacity: 0;
      }
      .image video,
      .image embed {
        width: 100%;
        height: 100%;
        border: 0;
        background: #000;
      }
      ep-zoom {
        position: absolute;
        inset: 0;
      }
      .topbar {
        position: absolute;
        inset: 0 0 auto 0;
        z-index: 3;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.9rem 1rem;
        color: #f2f0eb;
        background: linear-gradient(to bottom, rgb(0 0 0 / 0.45), transparent);
      }
      .pos {
        margin-left: 0.4rem;
        font-size: var(--ep-text-s);
        font-variant-numeric: tabular-nums;
        opacity: 0.75;
      }
      .grow {
        flex: 1;
      }
      .tool {
        display: grid;
        place-items: center;
        width: 2.6rem;
        height: 2.6rem;
        border: 0;
        border-radius: 50%;
        background: rgb(255 255 255 / 0.06);
        color: inherit;
        cursor: pointer;
        text-decoration: none;
        transition: background var(--ep-dur-fast);
      }
      .tool:hover {
        background: rgb(255 255 255 / 0.16);
      }
      .tool[aria-pressed='true'] {
        background: #f2f0eb;
        color: #111;
      }
      .tool wa-icon {
        font-size: 1.15rem;
      }
      .back {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0 1rem 0 0.75rem;
        height: 2.6rem;
        border-radius: 999px;
        background: rgb(255 255 255 / 0.08);
        color: inherit;
        text-decoration: none;
        font-size: var(--ep-text-s);
      }
      .back:hover {
        background: rgb(255 255 255 / 0.16);
      }
      .nav {
        position: absolute;
        top: 50%;
        z-index: 3;
        transform: translateY(-50%);
        display: grid;
        place-items: center;
        width: 3.2rem;
        height: 3.2rem;
        border: 0;
        border-radius: 50%;
        background: rgb(255 255 255 / 0.08);
        color: #f2f0eb;
        cursor: pointer;
        transition:
          background var(--ep-dur-fast),
          transform var(--ep-dur) var(--ep-ease);
      }
      .nav:hover {
        background: rgb(255 255 255 / 0.2);
      }
      .nav.prev {
        left: 1rem;
      }
      .nav.next {
        right: 1rem;
      }
      .nav.prev:hover {
        transform: translate(-2px, -50%);
      }
      .nav.next:hover {
        transform: translate(2px, -50%);
      }
      .nav wa-icon {
        font-size: 1.4rem;
      }
      .progress {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 3;
        height: 2px;
        background: rgb(255 255 255 / 0.12);
      }
      .progress span {
        display: block;
        height: 100%;
        background: #f2f0eb;
        animation: progress 5s linear forwards;
      }
      @keyframes progress {
        from {
          width: 0;
        }
        to {
          width: 100%;
        }
      }
      aside {
        position: relative;
        overflow-y: auto;
        overscroll-behavior: contain;
        background: var(--ep-bg);
        color: var(--ep-text);
        color-scheme: light dark;
        padding: clamp(1.5rem, 3vw, 2.5rem) clamp(1.25rem, 2.4vw, 2.25rem) 3rem;
        border-left: 1px solid var(--ep-border);
        scrollbar-width: thin;
      }
      .no-info aside {
        visibility: hidden;
        padding: 0;
        border: 0;
      }
      .error,
      .loading {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        align-content: center;
        gap: 1rem;
        color: #f2f0eb;
        text-align: center;
      }
      .error wa-icon {
        font-size: 2rem;
        opacity: 0.7;
      }
      .skeleton {
        height: 1rem;
        border-radius: 4px;
        background: var(--ep-placeholder);
        margin-bottom: 0.75rem;
      }
      @media (max-width: 900px) {
        :host {
          --panel: 100%;
        }
        :host([mode='overlay']) .viewer {
          display: block;
          overflow-y: auto;
        }
        .viewer,
        .viewer.no-info {
          grid-template-columns: 1fr;
          grid-template-rows: auto auto;
        }
        :host([mode='page']) .viewer {
          height: auto;
        }
        .stage {
          height: 72dvh;
        }
        .image {
          inset: 4rem 0.75rem 1.5rem;
        }
        .nav {
          width: 2.6rem;
          height: 2.6rem;
          top: auto;
          bottom: 0.75rem;
          transform: none;
        }
        .nav.prev:hover,
        .nav.next:hover {
          transform: none;
        }
        aside {
          border-left: 0;
          border-top: 1px solid var(--ep-border);
          overflow: visible;
        }
        .no-info aside {
          display: none;
        }
        .hide-narrow {
          display: none;
        }
      }
    `,
  ];

  constructor() {
    super();
    this.mode = 'page';
    this.related = [];
    this.error = false;
    this.info = storage.get<boolean>(INFO_KEY, true);
    this.zooming = false;
    this.playing = false;
    this.previewLoaded = false;
    new StoreController(this, this.services.search);
  }

  #onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.composedPath()[0] as HTMLElement;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (target?.closest?.('wa-dropdown, wa-dialog')) return;
    switch (event.key) {
      case 'ArrowLeft':
        this.#go(-1);
        break;
      case 'ArrowRight':
        this.#go(1);
        break;
      case 'Escape':
        if (this.zooming) this.zooming = false;
        else if (this.mode === 'overlay') this.#close();
        break;
      case 'i':
        this.#toggleInfo();
        break;
      case 'z':
        this.#toggleZoom();
        break;
      case 'f':
        this.#fullscreen();
        break;
      case ' ':
        if (this.mode === 'overlay') {
          event.preventDefault();
          this.#togglePlay();
        }
        break;
      default:
        return;
    }
  };

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.#onKey);
    if (this.mode === 'overlay') {
      this.#returnFocus = document.activeElement;
      document.body.classList.add('ep-scroll-lock');
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.#onKey);
    window.clearTimeout(this.#timer);
    if (this.mode === 'overlay') {
      document.body.classList.remove('ep-scroll-lock');
      (this.#returnFocus as HTMLElement | null)?.focus?.({ preventScroll: true });
    }
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('assetId') && this.assetId !== this.#loadedFor) {
      this.#loadedFor = this.assetId;
      void this.#load(this.assetId);
    }
  }

  protected override firstUpdated(): void {
    this.renderRoot.querySelector<HTMLElement>('.viewer')?.focus({ preventScroll: true });
  }

  /** Bekannte Listendaten (Vorschaubild, Titel) sofort zeigen, Details nachladen. */
  #fromList(id: string): Asset | undefined {
    return this.services.search.state.results.items.find((a) => a.id === id);
  }

  async #load(id: string) {
    this.error = false;
    this.zooming = false;
    this.zoomUrl = undefined;
    this.previewLoaded = false;
    this.related = [];
    const known = this.#fromList(id);
    if (known && this.asset?.id !== id) {
      this.asset = { ...known, preview: known.thumbnail, groups: [], categories: [] } as AssetDetail;
    }
    try {
      const detail = await this.services.catalog.getAsset(id);
      if (id !== this.assetId) return;
      this.asset = detail;
      document.title = `${detail.title || this.t('common.untitled')} – ${this.pick(this.services.config.branding.name)}`;
      this.#preloadNeighbours();
      const relations = this.services.config.detail.relations;
      if (relations.length) {
        this.services.catalog
          .getRelated(id, relations)
          .then((related) => id === this.assetId && (this.related = related))
          .catch(() => undefined);
      }
    } catch {
      if (id === this.assetId) this.error = true;
    }
  }

  #preloadNeighbours() {
    for (const offset of [1, -1]) {
      const neighbour = this.#neighbour(offset);
      if (neighbour) this.services.catalog.getAsset(neighbour.id).catch(() => undefined);
    }
  }

  get #list(): Asset[] {
    return this.mode === 'overlay' ? this.services.search.state.results.items : [];
  }

  get #index(): number {
    return this.#list.findIndex((a) => a.id === this.assetId);
  }

  #neighbour(offset: number): Asset | undefined {
    const list = this.#list;
    const index = this.#index;
    if (index < 0 || !list.length) return undefined;
    return list[(index + offset + list.length) % list.length];
  }

  async #go(offset: number) {
    if (this.mode !== 'overlay') return;
    const { search, router } = this.services;
    const index = this.#index;
    if (index < 0) return;
    // Am Ende weitere Treffer nachladen, bevor zum Anfang gesprungen wird.
    if (offset > 0 && index === this.#list.length - 1 && search.state.results.cursor) await search.loadMore();
    const next = this.#neighbour(offset);
    if (!next || next.id === this.assetId) return;
    router.navigate(this.href(`/bild/${encodeURIComponent(next.id)}`), {
      replace: true,
      state: { ...router.location.state },
    });
  }

  #close() {
    const { router } = this.services;
    this.playing = false;
    if (history.state?.overlayOf) history.back();
    else router.navigate(this.href('/suche'));
  }

  #toggleInfo() {
    this.info = !this.info;
    storage.set(INFO_KEY, this.info);
  }

  async #toggleZoom() {
    if (this.zooming) {
      this.zooming = false;
      return;
    }
    if (!this.asset || this.asset.mediaType !== 'image') return;
    this.playing = false;
    this.zoomUrl ??= (await this.services.catalog.getZoomUrl(this.asset.id)) ?? this.asset.preview;
    this.zooming = true;
  }

  #fullscreen() {
    const el = this.renderRoot.querySelector<HTMLElement>('.stage');
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }

  #togglePlay() {
    this.playing = !this.playing;
    this.#schedule();
  }

  #schedule() {
    window.clearTimeout(this.#timer);
    if (!this.playing) return;
    this.#timer = window.setTimeout(async () => {
      await this.#go(1);
      this.#schedule();
    }, 5000);
  }

  #onTouchStart(event: TouchEvent) {
    this.#touchX = event.touches.length === 1 ? event.touches[0].clientX : undefined;
  }

  #onTouchEnd(event: TouchEvent) {
    if (this.#touchX === undefined || this.zooming) return;
    const dx = event.changedTouches[0].clientX - this.#touchX;
    if (Math.abs(dx) > 60) this.#go(dx < 0 ? 1 : -1);
    this.#touchX = undefined;
  }

  #media() {
    const asset = this.asset!;
    if (this.zooming && this.zoomUrl) return html`<ep-zoom .src=${this.zoomUrl}></ep-zoom>`;
    if (asset.mediaType === 'video') {
      return html`<div class="image">
        <video src=${asset.preview} poster=${asset.thumbnail} controls playsinline></video>
      </div>`;
    }
    if (asset.mediaType === 'pdf' && asset.previewMime?.includes('pdf')) {
      return html`<div class="image"><embed src=${asset.preview} type="application/pdf" /></div>`;
    }
    const hasPreview = asset.preview && asset.preview !== asset.thumbnail;
    return html`<div class="image" @dblclick=${this.#toggleZoom}>
      <img
        class="thumb ${hasPreview && this.previewLoaded ? 'hidden' : ''}"
        src=${asset.thumbnail}
        alt=""
        aria-hidden="true"
      />
      ${
        hasPreview
          ? html`<img
              class="preview ${this.previewLoaded ? '' : 'hidden'}"
              src=${asset.preview}
              alt=${asset.title}
              @load=${() => (this.previewLoaded = true)}
            />`
          : nothing
      }
    </div>`;
  }

  override render() {
    const overlay = this.mode === 'overlay';
    const list = this.#list;
    const index = this.#index;
    const total = this.services.search.state.results.total;
    const multiple = overlay && list.length > 1 && index >= 0;
    return html`<div
      class="viewer ${this.info ? '' : 'no-info'}"
      role=${overlay ? 'dialog' : 'region'}
      aria-modal=${overlay ? 'true' : nothing}
      aria-label=${this.asset?.title ?? this.t('detail.info')}
      tabindex="-1"
    >
      <div class="stage" @touchstart=${this.#onTouchStart} @touchend=${this.#onTouchEnd}>
        ${this.asset ? this.#media() : this.error ? nothing : html`<div class="loading"><wa-spinner style="font-size:2rem"></wa-spinner></div>`}
        ${
          this.error
            ? html`<div class="error">
                <wa-icon name="image-off"></wa-icon>
                <p>${this.t('detail.loadError')}</p>
                <wa-button pill appearance="outlined" href=${this.href('/')}
                  >${this.t('app.backHome')}</wa-button
                >
              </div>`
            : nothing
        }
        <div class="topbar">
          ${
            overlay
              ? html`<button
                  type="button"
                  class="tool"
                  aria-label=${this.t('detail.close')}
                  title="${this.t('detail.close')} (Esc)"
                  @click=${this.#close}
                >
                  <wa-icon name="x"></wa-icon>
                </button>`
              : html`<a class="back" href=${this.href('/suche')}
                  ><wa-icon name="arrow-left"></wa-icon>${this.t('nav.search')}</a
                >`
          }
          ${multiple ? html`<span class="pos">${this.t('detail.position', { index: index + 1, total })}</span>` : nothing}
          <span class="grow"></span>
          ${
            this.asset?.mediaType === 'image'
              ? html`<button
                  type="button"
                  class="tool"
                  aria-pressed=${this.zooming ? 'true' : 'false'}
                  aria-label=${this.t('detail.zoom')}
                  title="${this.t('detail.zoom')} (Z)"
                  @click=${this.#toggleZoom}
                >
                  <wa-icon name="zoom-in"></wa-icon>
                </button>`
              : nothing
          }
          ${
            multiple
              ? html`<button
                  type="button"
                  class="tool hide-narrow"
                  aria-pressed=${this.playing ? 'true' : 'false'}
                  aria-label=${this.playing ? this.t('detail.slideshowStop') : this.t('detail.slideshow')}
                  title=${this.playing ? this.t('detail.slideshowStop') : this.t('detail.slideshow')}
                  @click=${this.#togglePlay}
                >
                  <wa-icon name=${this.playing ? 'pause' : 'play'}></wa-icon>
                </button>`
              : nothing
          }
          <button
            type="button"
            class="tool hide-narrow"
            aria-label=${this.t('detail.fullscreen')}
            title="${this.t('detail.fullscreen')} (F)"
            @click=${this.#fullscreen}
          >
            <wa-icon name="maximize"></wa-icon>
          </button>
          <button
            type="button"
            class="tool hide-narrow"
            aria-pressed=${this.info ? 'true' : 'false'}
            aria-label=${this.t('detail.info')}
            title="${this.t('detail.info')} (I)"
            @click=${this.#toggleInfo}
          >
            <wa-icon name="info"></wa-icon>
          </button>
        </div>
        ${
          multiple && !this.zooming
            ? html`<button
                  type="button"
                  class="nav prev"
                  aria-label=${this.t('detail.prev')}
                  @click=${() => this.#go(-1)}
                >
                  <wa-icon name="chevron-left"></wa-icon>
                </button>
                <button
                  type="button"
                  class="nav next"
                  aria-label=${this.t('detail.next')}
                  @click=${() => this.#go(1)}
                >
                  <wa-icon name="chevron-right"></wa-icon>
                </button>`
            : nothing
        }
        ${this.playing ? html`<div class="progress">${keyed(this.assetId, html`<span></span>`)}</div>` : nothing}
      </div>
      <aside aria-label=${this.t('detail.info')}>
        ${
          this.asset && this.asset.groups.length
            ? html`<ep-asset-info .asset=${this.asset} .related=${this.related}></ep-asset-info>`
            : this.error
              ? nothing
              : html`<div class="skeleton" style="width:30%"></div>
                  <div class="skeleton" style="height:2.2rem;width:85%"></div>
                  <div class="skeleton" style="width:55%"></div>`
        }
      </aside>
    </div>`;
  }
}

customElements.define('ep-asset-viewer', EpAssetViewer);
