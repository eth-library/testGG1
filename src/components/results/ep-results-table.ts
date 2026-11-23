import { css, html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import type { Asset } from '../../data/model.ts';

/** Listenansicht mit konfigurierbaren Spalten und sortierbaren Köpfen. */
export class EpResultsTable extends EpElement {
  static override properties = {
    items: { attribute: false },
    selecting: { type: Boolean },
    selected: { attribute: false },
  };

  declare items: Asset[];
  declare selecting: boolean;
  declare selected: Set<string>;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: var(--ep-text-s);
      }
      th {
        position: sticky;
        top: calc(var(--ep-header-h) + var(--ep-toolbar-h, 0px));
        z-index: 1;
        background: var(--ep-bg);
        text-align: left;
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ep-muted);
        padding: 0.75rem 0.75rem;
        border-bottom: 1px solid var(--ep-border);
        white-space: nowrap;
      }
      th button {
        all: unset;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
      }
      th button:hover {
        color: var(--ep-text);
      }
      th button:focus-visible {
        outline: 2px solid var(--ep-accent);
        outline-offset: 2px;
      }
      td {
        padding: 0.6rem 0.75rem;
        border-bottom: 1px solid var(--ep-border);
        vertical-align: middle;
      }
      tr {
        transition: background var(--ep-dur-fast);
      }
      tbody tr:hover {
        background: var(--ep-hover);
      }
      tr[aria-selected='true'] {
        background: var(--ep-accent-soft);
      }
      .thumb {
        width: 5.5rem;
      }
      .thumb a {
        display: block;
        width: 4.75rem;
        height: 3.5rem;
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
      .title a {
        color: var(--ep-text);
        text-decoration: none;
        font-weight: 500;
        line-height: 1.35;
      }
      .title a:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .muted {
        color: var(--ep-muted);
      }
      .num {
        font-variant-numeric: tabular-nums;
      }
      td.actions {
        text-align: right;
        white-space: nowrap;
      }
      @media (max-width: 720px) {
        .opt {
          display: none;
        }
      }
    `,
  ];

  constructor() {
    super();
    this.items = [];
    this.selecting = false;
    this.selected = new Set();
    new StoreController(this, this.services.basket, this.services.search);
  }

  #sortFor(field: string): { asc?: string; desc?: string } {
    const ids = new Set(this.services.config.search.sortOptions.map((o) => o.id));
    return {
      asc: ids.has(`${field}_asc`) ? `${field}_asc` : undefined,
      desc: ids.has(`${field}_desc`) ? `${field}_desc` : undefined,
    };
  }

  #toggleSort(field: string) {
    const { asc, desc } = this.#sortFor(field);
    const current = this.services.search.state.query.sort;
    const next = current === asc && desc ? desc : (asc ?? desc);
    if (next) this.services.search.update({ sort: next });
  }

  override render() {
    const { config, catalog, search, basket } = this.services;
    const defs = catalog.fieldDefinitions();
    const columns = config.results.tableColumns;
    const sort = search.state.query.sort;
    const header = (field: string, label: string) => {
      const { asc, desc } = this.#sortFor(field);
      if (!asc && !desc) return html`${label}`;
      const state = sort === asc ? 'ascending' : sort === desc ? 'descending' : 'none';
      return html`<button type="button" @click=${() => this.#toggleSort(field)} aria-sort=${state}>
        ${label}
        ${
          state !== 'none'
            ? html`<wa-icon name=${state === 'ascending' ? 'chevron-up' : 'chevron-down'}></wa-icon>`
            : nothing
        }
      </button>`;
    };
    return html`<table>
      <thead>
        <tr>
          <th class="thumb"><span class="visually-hidden">${this.t('results.preview')}</span></th>
          <th>${header(config.fields.title ?? 'title', this.t('results.title'))}</th>
          ${columns.map(
            (col, i) =>
              html`<th class=${i > 1 ? 'opt' : ''}>
                ${header(col.field, this.pick(col.label) || defs.get(col.field)?.label || col.field)}
              </th>`,
          )}
          <th><span class="visually-hidden">${this.t('results.actions')}</span></th>
        </tr>
      </thead>
      <tbody>
        ${repeat(
          this.items,
          (a) => a.id,
          (asset) => {
            const href = this.href(`/bild/${encodeURIComponent(asset.id)}`);
            const inBasket = basket.has(asset.id);
            const select = (event: Event) => {
              if (!this.selecting) return;
              event.preventDefault();
              this.emit('ep-select', { id: asset.id, selected: !this.selected.has(asset.id) });
            };
            return html`<tr aria-selected=${this.selecting ? String(this.selected.has(asset.id)) : nothing}>
              <td class="thumb">
                <a href=${href} data-overlay="true" tabindex="-1" aria-hidden="true" @click=${select}>
                  <img src=${asset.thumbnail} alt="" loading="lazy" decoding="async" />
                </a>
              </td>
              <td class="title">
                ${
                  this.selecting
                    ? html`<wa-checkbox
                        ?checked=${this.selected.has(asset.id)}
                        @change=${select}
                        aria-label=${asset.title}
                        >${asset.title || this.t('common.untitled')}</wa-checkbox
                      >`
                    : html`<a href=${href} data-overlay="true"
                        >${asset.title || this.t('common.untitled')}</a
                      >`
                }
              </td>
              ${columns.map(
                (col, i) =>
                  html`<td class="${i > 1 ? 'opt' : ''} ${i === 0 ? 'muted num' : ''}">
                    ${asset.fields[col.field]?.map((v) => v.label).join(', ') ?? ''}
                  </td>`,
              )}
              <td class="actions">
                ${
                  config.basket.enabled
                    ? html`<wa-button
                        size="s"
                        appearance="plain"
                        aria-pressed=${inBasket ? 'true' : 'false'}
                        title=${inBasket ? this.t('detail.removeFromBasket') : this.t('detail.addToBasket')}
                        @click=${() => basket.toggle(asset)}
                      >
                        <wa-icon
                          name=${inBasket ? 'bookmark-check' : 'bookmark-plus'}
                          label=${inBasket ? this.t('detail.removeFromBasket') : this.t('detail.addToBasket')}
                        ></wa-icon>
                      </wa-button>`
                    : nothing
                }
              </td>
            </tr>`;
          },
        )}
      </tbody>
    </table>`;
  }
}

customElements.define('ep-results-table', EpResultsTable);
