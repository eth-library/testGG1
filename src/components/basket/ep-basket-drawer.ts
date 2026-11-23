import { css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import type { DownloadFormat } from '../../data/model.ts';
import { copyText } from '../../features/share.ts';
import { exportCsv } from '../../features/export-csv.ts';

/** Auswahl («Korb»): Formate wählen, als ZIP laden, teilen, Metadaten exportieren. */
export class EpBasketDrawer extends EpElement {
  static override properties = {
    formats: { state: true },
    busy: { state: true },
    exporting: { state: true },
  };

  declare formats: DownloadFormat[];
  declare busy: boolean;
  declare exporting: string;
  #formatsFor = '';

  static override styles = [
    EpElement.baseStyles,
    css`
      wa-drawer {
        --size: min(30rem, 100vw);
      }
      wa-drawer::part(body) {
        padding-top: 0;
      }
      .count {
        font-size: var(--ep-text-s);
        color: var(--ep-muted);
        font-weight: 400;
        margin-left: 0.5rem;
      }
      .all {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.5rem 0 1rem;
        border-bottom: 1px solid var(--ep-border);
        font-size: var(--ep-text-s);
      }
      .all wa-select {
        width: 14rem;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li {
        display: grid;
        grid-template-columns: 4.5rem minmax(0, 1fr) auto;
        gap: 0.9rem;
        align-items: center;
        padding: 0.8rem 0;
        border-bottom: 1px solid var(--ep-border);
        animation: in var(--ep-dur) var(--ep-ease);
      }
      @keyframes in {
        from {
          opacity: 0;
          transform: translateX(10px);
        }
      }
      .thumb {
        display: block;
        width: 4.5rem;
        height: 3.4rem;
        border-radius: var(--ep-radius-s);
        overflow: hidden;
        background: var(--ep-placeholder);
      }
      .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .title {
        font-size: var(--ep-text-s);
        font-weight: 500;
        line-height: 1.35;
        color: var(--ep-text);
        text-decoration: none;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .title:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .row-meta {
        margin-top: 0.35rem;
      }
      .row-meta wa-select {
        max-width: 13rem;
      }
      .restricted {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        font-size: var(--ep-text-xs);
        color: var(--ep-muted);
      }
      .empty {
        display: grid;
        justify-items: center;
        gap: 0.75rem;
        padding: 18vh 1rem 0;
        text-align: center;
      }
      .empty wa-icon {
        font-size: 2.25rem;
        color: var(--ep-muted);
      }
      .empty h3 {
        margin: 0;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: 1.75rem;
      }
      .empty p {
        margin: 0;
        color: var(--ep-muted);
        max-width: 30ch;
      }
      .terms {
        margin-top: 1rem;
        padding: 1rem;
        border-radius: var(--ep-radius-m);
        background: var(--ep-lowered);
        font-size: var(--ep-text-s);
        line-height: 1.55;
      }
      .terms h4 {
        margin: 0 0 0.4rem;
        font-size: var(--ep-text-xs);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ep-muted);
      }
      .terms p {
        margin: 0 0 0.75rem;
      }
      .footer {
        display: grid;
        gap: 0.5rem;
        width: 100%;
      }
      .secondary {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        justify-content: space-between;
      }
    `,
  ];

  constructor() {
    super();
    this.formats = [];
    this.busy = false;
    this.exporting = '';
    new StoreController(this, this.services.basket);
  }

  protected override willUpdate(): void {
    const { basket } = this.services;
    const first = basket.state.items.find((i) => i.downloadable);
    if (basket.state.open && first && first.id !== this.#formatsFor) {
      this.#formatsFor = first.id;
      this.services.catalog
        .getDownloadFormats(first.id)
        .then((formats) => (this.formats = formats.filter((f) => !f.onDemand)))
        .catch(() => (this.formats = []));
    }
  }

  get #defaultFormat(): string {
    const preferred = this.services.config.basket.defaultFormat;
    return this.formats.some((f) => f.id === preferred) ? preferred : (this.formats[0]?.id ?? preferred);
  }

  async #download() {
    const { basket, catalog, config, toast, analytics } = this.services;
    if (config.basket.termsOfUse === 'require' && !basket.state.termsAccepted) {
      toast.show(this.t('basket.termsRequired'), { variant: 'danger', icon: 'warning' });
      return;
    }
    const items = basket.state.items
      .filter((i) => i.downloadable)
      .map((i) => ({ id: i.id, format: i.format ?? this.#defaultFormat }));
    if (!items.length) return;
    this.busy = true;
    try {
      await catalog.downloadZip(items);
      items.forEach((i) => analytics.download(`zip:${i.id}`, i.format, i.id));
      toast.show(this.t('basket.zipStarted'), { icon: 'package' });
      if (config.basket.clearAfterDownload) basket.clear();
    } catch {
      toast.show(this.t('download.failed'), { variant: 'danger', icon: 'warning' });
    } finally {
      this.busy = false;
    }
  }

  async #share() {
    const { basket, router, toast } = this.services;
    const ids = basket.state.items.map((i) => i.id).join(',');
    const url = new URL(router.href('/auswahl', { ids }), location.origin).href;
    if (await copyText(url)) toast.show(this.t('basket.shareCopied'), { icon: 'link' });
  }

  async #export() {
    const ids = this.services.basket.state.items.map((i) => i.id);
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

  #formatSelect(value: string, onChange: (value: string) => void, label: string) {
    return html`<wa-select
      size="s"
      .value=${value}
      aria-label=${label}
      @change=${(e: Event) => onChange((e.target as HTMLSelectElement).value)}
    >
      ${this.formats.map((f) => html`<wa-option value=${f.id}>${f.label}</wa-option>`)}
    </wa-select>`;
  }

  override render() {
    const { basket, config } = this.services;
    const { items, open, termsAccepted } = basket.state;
    const downloadable = items.filter((i) => i.downloadable).length;
    const terms = config.basket.termsOfUse;
    return html`<wa-drawer
      placement="end"
      ?open=${open}
      @wa-after-hide=${(e: Event) => e.target === e.currentTarget && basket.setOpen(false)}
    >
      <span slot="label"
        >${this.t('basket.title')}<span class="count"
          >${this.t('basket.count', { count: items.length })}</span
        ></span
      >
      ${
        !items.length
          ? html`<div class="empty">
              <wa-icon name="bookmark"></wa-icon>
              <h3>${this.t('basket.empty.title')}</h3>
              <p>${this.t('basket.empty.text')}</p>
            </div>`
          : html`
              ${
                this.formats.length
                  ? html`<div class="all">
                      <span>${this.t('basket.formatAll')}</span>
                      ${this.#formatSelect(
                        items[0]?.format ?? this.#defaultFormat,
                        (value) => basket.setAllFormats(value),
                        this.t('basket.formatAll'),
                      )}
                    </div>`
                  : nothing
              }
              <ul>
                ${repeat(
                  items,
                  (i) => i.id,
                  (item) =>
                    html`<li>
                      <a
                        class="thumb"
                        href=${this.href(`/bild/${encodeURIComponent(item.id)}`)}
                        @click=${() => basket.setOpen(false)}
                      >
                        <img src=${item.thumbnail} alt="" loading="lazy" />
                      </a>
                      <div>
                        <a
                          class="title"
                          href=${this.href(`/bild/${encodeURIComponent(item.id)}`)}
                          @click=${() => basket.setOpen(false)}
                          >${item.title || this.t('common.untitled')}</a
                        >
                        <div class="row-meta">
                          ${
                            item.downloadable
                              ? this.formats.length
                                ? this.#formatSelect(
                                    item.format ?? this.#defaultFormat,
                                    (value) => basket.setFormat(item.id, value),
                                    this.t('basket.format'),
                                  )
                                : nothing
                              : html`<span class="restricted"
                                  ><wa-icon name="lock"></wa-icon>${this.t('basket.restricted')}</span
                                >`
                          }
                        </div>
                      </div>
                      <wa-button
                        size="s"
                        appearance="plain"
                        @click=${() => basket.remove(item.id)}
                        title=${this.t('basket.remove')}
                      >
                        <wa-icon name="trash" label=${this.t('basket.remove')}></wa-icon>
                      </wa-button>
                    </li>`,
                )}
              </ul>
              ${
                terms !== 'off' && config.basket.termsText
                  ? html`<div class="terms">
                      <h4>${this.t('basket.terms')}</h4>
                      <p>${this.pick(config.basket.termsText)}</p>
                      ${
                        terms === 'require'
                          ? html`<wa-checkbox
                              ?checked=${termsAccepted}
                              @change=${(e: Event) => basket.acceptTerms((e.target as HTMLInputElement).checked)}
                              >${this.t('basket.termsAccept')}</wa-checkbox
                            >`
                          : nothing
                      }
                    </div>`
                  : nothing
              }
            `
      }
      ${
        items.length
          ? html`<div slot="footer" class="footer">
              <wa-button
                variant="brand"
                appearance="accent"
                pill
                ?loading=${this.busy}
                ?disabled=${!downloadable || (terms === 'require' && !termsAccepted)}
                @click=${this.#download}
              >
                <wa-icon slot="start" name="package"></wa-icon>${this.t('basket.download')}
              </wa-button>
              <div class="secondary">
                <wa-button size="s" appearance="plain" @click=${this.#share}>
                  <wa-icon slot="start" name="link"></wa-icon>${this.t('basket.share')}
                </wa-button>
                <wa-button size="s" appearance="plain" ?loading=${!!this.exporting} @click=${this.#export}>
                  <wa-icon slot="start" name="csv"></wa-icon>${this.exporting || this.t('results.exportCsv')}
                </wa-button>
                <wa-button size="s" appearance="plain" variant="danger" @click=${() => basket.clear()}>
                  <wa-icon slot="start" name="trash"></wa-icon>${this.t('basket.clear')}
                </wa-button>
              </div>
            </div>`
          : nothing
      }
    </wa-drawer>`;
  }
}

customElements.define('ep-basket-drawer', EpBasketDrawer);
