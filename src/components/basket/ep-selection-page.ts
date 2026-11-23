import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import type { Asset } from '../../data/model.ts';
import '../results/ep-results.ts';

/** Geteilte Auswahl (/auswahl?ids=…): Bilder ansehen und in die eigene Auswahl übernehmen. */
export class EpSelectionPage extends EpElement {
  static override properties = { items: { state: true }, loading: { state: true } };
  declare items: Asset[];
  declare loading: boolean;

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
      header {
        display: flex;
        flex-wrap: wrap;
        align-items: end;
        justify-content: space-between;
        gap: 1.5rem;
        padding: clamp(2.5rem, 6vw, 4rem) 0 2rem;
      }
      .eyebrow {
        margin: 0 0 0.75rem;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ep-muted);
      }
      h1 {
        margin: 0;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: var(--ep-display-m);
        line-height: 1;
      }
      p {
        margin: 0.75rem 0 0;
        color: var(--ep-muted);
      }
    `,
  ];

  constructor() {
    super();
    this.items = [];
    this.loading = true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.title = `${this.t('basket.shared.title')} – ${this.pick(this.services.config.branding.name)}`;
    void this.#load();
  }

  async #load() {
    const ids = (this.services.router.location.query.get('ids') ?? '')
      .split(',')
      .filter(Boolean)
      .slice(0, 200);
    try {
      this.items = await this.services.catalog.getAssets(ids);
    } finally {
      this.loading = false;
    }
  }

  #addAll() {
    const { basket, toast } = this.services;
    const added = basket.add(this.items);
    toast.show(this.t('basket.addedMany', { count: added }), { icon: 'bookmark-check' });
    basket.setOpen(true);
  }

  override render() {
    return html`<div class="wrap">
      <header>
        <div>
          <p class="eyebrow">${this.t('basket.title')}</p>
          <h1>${this.t('basket.shared.title')}</h1>
          ${this.loading ? nothing : html`<p>${this.t('basket.shared.text', { count: this.items.length })}</p>`}
        </div>
        ${
          this.items.length && this.services.config.basket.enabled
            ? html`<wa-button variant="brand" appearance="accent" pill @click=${this.#addAll}>
                <wa-icon slot="start" name="bookmark-plus"></wa-icon>${this.t('basket.shared.add')}
              </wa-button>`
            : nothing
        }
      </header>
      <ep-results .items=${this.items} view="justified" size="240" ?loading=${this.loading}></ep-results>
    </div>`;
  }
}

customElements.define('ep-selection-page', EpSelectionPage);
