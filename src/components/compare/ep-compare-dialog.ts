import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import type { AssetDetail } from '../../data/model.ts';

/** Vergleich zweier Bilder: Wisch-Regler und Metadaten nebeneinander. */
export class EpCompareDialog extends EpElement {
  static override properties = {
    ids: { attribute: false },
    assets: { state: true },
    open: { state: true },
  };

  declare ids: string[];
  declare assets: AssetDetail[];
  declare open: boolean;

  static override styles = [
    EpElement.baseStyles,
    css`
      wa-dialog {
        --width: min(76rem, 96vw);
      }
      wa-dialog::part(body) {
        padding-top: 0;
      }
      wa-comparison {
        display: block;
        width: 100%;
        max-height: 62vh;
        border-radius: var(--ep-radius-m);
        overflow: hidden;
        background: var(--ep-lowered);
        --handle-size: 2.75rem;
      }
      wa-comparison img {
        display: block;
        width: 100%;
        height: 62vh;
        object-fit: contain;
      }
      .meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
        margin-top: 1.25rem;
      }
      h3 {
        margin: 0 0 0.4rem;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: 1.5rem;
        line-height: 1.15;
      }
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.3rem 1rem;
        margin: 0;
        font-size: var(--ep-text-s);
      }
      dt {
        color: var(--ep-muted);
      }
      dd {
        margin: 0;
      }
      .label {
        font-size: var(--ep-text-xs);
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ep-muted);
      }
      .loading {
        display: grid;
        place-items: center;
        height: 50vh;
      }
      @media (max-width: 700px) {
        .meta {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  constructor() {
    super();
    this.ids = [];
    this.assets = [];
    this.open = true;
  }

  override async connectedCallback() {
    super.connectedCallback();
    this.assets = await Promise.all(this.ids.slice(0, 2).map((id) => this.services.catalog.getAsset(id)));
  }

  #fields(asset: AssetDetail) {
    const { config } = this.services;
    const ids = [
      config.fields.date,
      config.fields.creator,
      config.fields.signature,
      config.fields.license,
    ].filter((f): f is string => !!f);
    const all = new Map(asset.groups.flatMap((g) => g.fields).map((f) => [f.id, f]));
    return ids.map((id) => all.get(id)).filter((f) => !!f);
  }

  override render() {
    const [a, b] = this.assets;
    return html`<wa-dialog
      label=${this.t('compare.title')}
      ?open=${this.open}
      light-dismiss
      @wa-after-hide=${(e: Event) => e.target === e.currentTarget && this.emit('ep-close')}
    >
      ${
        a && b
          ? html`<wa-comparison position="50" aria-label=${this.t('compare.slider')}>
                <img slot="before" src=${a.preview} alt=${a.title} />
                <img slot="after" src=${b.preview} alt=${b.title} />
              </wa-comparison>
              <div class="meta">
                ${[a, b].map(
                  (asset, i) =>
                    html`<div>
                      <div class="label">${i === 0 ? '◀' : '▶'}</div>
                      <h3>${asset.title}</h3>
                      <dl>
                        ${this.#fields(asset).map(
                          (f) =>
                            html`<dt>${f!.label}</dt>
                              <dd>${f!.values.map((v) => v.label).join(', ')}</dd>`,
                        )}
                      </dl>
                    </div>`,
                )}
              </div>`
          : html`<div class="loading"><wa-spinner style="font-size:2rem"></wa-spinner></div>`
      }
      ${nothing}
    </wa-dialog>`;
  }
}

customElements.define('ep-compare-dialog', EpCompareDialog);
