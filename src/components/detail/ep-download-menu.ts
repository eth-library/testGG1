import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import type { AssetDetail, DownloadFormat } from '../../data/model.ts';
import { contactHref, triggerDownload } from '../../features/share.ts';

/** Download-Menü (Formate werden beim Öffnen geladen) bzw. Bestell-Link bei gesperrten Bildern. */
export class EpDownloadMenu extends EpElement {
  static override properties = {
    asset: { attribute: false },
    appearance: {},
    formats: { state: true },
    busy: { state: true },
  };

  declare asset: AssetDetail;
  declare appearance: 'accent' | 'filled' | 'outlined' | 'plain';
  declare formats: DownloadFormat[] | null;
  declare busy: string;
  #loadedFor = '';

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: inline-block;
      }
      .desc {
        font-size: var(--ep-text-xs);
        color: var(--ep-muted);
      }
      .loading {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.6rem 0.9rem;
        font-size: var(--ep-text-s);
        color: var(--ep-muted);
      }
    `,
  ];

  constructor() {
    super();
    this.appearance = 'accent';
    this.formats = null;
    this.busy = '';
  }

  /** Schlüssel aus Asset und Sprache – Formatnamen sind lokalisiert. */
  get #key(): string {
    return `${this.asset?.id ?? ''}|${this.services.i18n.locale}`;
  }

  protected override willUpdate(): void {
    if (this.asset && this.#key !== this.#loadedFor) {
      this.#loadedFor = this.#key;
      this.formats = null;
    }
  }

  async #load() {
    if (this.formats) return;
    const key = this.#key;
    let formats: DownloadFormat[];
    try {
      formats = await this.services.catalog.getDownloadFormats(this.asset.id);
    } catch {
      formats = [];
    }
    // Antwort verwerfen, falls inzwischen ein anderes Bild oder eine andere Sprache aktiv ist.
    if (key === this.#key) this.formats = formats;
  }

  async #download(format: DownloadFormat) {
    const { catalog, analytics, toast } = this.services;
    this.busy = format.id;
    try {
      const url = await catalog.getDownloadUrl(this.asset.id, format.id, () =>
        toast.show(this.t('download.preparing'), { icon: 'download' }),
      );
      analytics.download(url, format.id, this.asset.id);
      const name = format.description?.split(' (')[0];
      triggerDownload(
        url,
        url.startsWith('data:') || url.startsWith('blob:') ? name || `${this.asset.id}` : undefined,
      );
    } catch {
      toast.show(this.t('download.failed'), { variant: 'danger', icon: 'warning' });
    } finally {
      this.busy = '';
    }
  }

  override render() {
    const { config } = this.services;
    if (!this.asset) return nothing;
    if (!this.asset.downloadable) {
      const order = config.download.order;
      if (!order) return nothing;
      const signature = this.asset.fields[config.fields.signature ?? '']?.[0]?.label;
      return html`<wa-button
        size="s"
        appearance=${this.appearance}
        variant="brand"
        pill
        href=${contactHref(order, { id: this.asset.id, title: this.asset.title, signature })}
        target=${order.mode === 'url' ? '_blank' : nothing}
      >
        <wa-icon slot="start" name="mail"></wa-icon>${this.t('detail.order')}
      </wa-button>`;
    }
    return html`<wa-dropdown
      placement="bottom-end"
      @wa-show=${() => this.#load()}
      @wa-select=${(e: CustomEvent<{ item: { value: string } }>) => {
        const format = this.formats?.find((f) => f.id === e.detail.item.value);
        if (format) void this.#download(format);
      }}
    >
      <wa-button
        slot="trigger"
        size="s"
        appearance=${this.appearance}
        variant="brand"
        pill
        ?loading=${!!this.busy}
        with-caret
      >
        <wa-icon slot="start" name="download"></wa-icon>${this.t('detail.download')}
      </wa-button>
      ${
        this.formats === null
          ? html`<div class="loading"><wa-spinner></wa-spinner>${this.t('download.loading')}</div>`
          : this.formats.length
            ? this.formats.map(
                (f) =>
                  html`<wa-dropdown-item value=${f.id}>
                    <wa-icon slot="icon" name=${f.onDemand ? 'sparkles' : 'download'}></wa-icon>
                    ${f.label}
                    <span slot="details" class="desc"
                      >${f.onDemand ? this.t('download.onDemand') : (f.description?.match(/\(([^)]+)\)$/)?.[1] ?? '')}</span
                    >
                  </wa-dropdown-item>`,
              )
            : html`<div class="loading">${this.t('download.none')}</div>`
      }
    </wa-dropdown>`;
  }
}

customElements.define('ep-download-menu', EpDownloadMenu);
