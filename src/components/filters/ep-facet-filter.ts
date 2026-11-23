import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import type { FilterConfig } from '../../config/schema.ts';
import type { FacetOption } from '../../data/model.ts';

const VISIBLE = 6;

/** Listen- bzw. Relationsfilter mit Trefferzahlen, Werte-Suche und «alle anzeigen». */
export class EpFacetFilter extends EpElement {
  static override properties = {
    filter: { attribute: false },
    expanded: { state: true },
    query: { state: true },
    relationOptions: { state: true },
  };

  declare filter: FilterConfig;
  declare expanded: boolean;
  declare query: string;
  declare relationOptions: FacetOption[] | null;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
      }
      .search {
        margin-bottom: 0.5rem;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      label {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 0.6rem;
        padding: 0.32rem 0.45rem;
        margin: 0 -0.45rem;
        border-radius: var(--ep-radius-s);
        cursor: pointer;
        font-size: var(--ep-text-s);
        line-height: 1.3;
        transition: background var(--ep-dur-fast);
      }
      label:hover {
        background: var(--ep-hover);
      }
      input {
        appearance: none;
        margin: 0;
        width: 1rem;
        height: 1rem;
        border: 1.5px solid var(--ep-border-strong);
        border-radius: 0.28rem;
        display: grid;
        place-items: center;
        transition: all var(--ep-dur-fast);
        background: var(--ep-surface);
      }
      input[type='radio'] {
        border-radius: 50%;
      }
      input:checked {
        background: var(--ep-accent);
        border-color: var(--ep-accent);
      }
      input:checked::after {
        content: '';
        width: 0.5rem;
        height: 0.28rem;
        border-left: 2px solid var(--ep-accent-on);
        border-bottom: 2px solid var(--ep-accent-on);
        transform: translateY(-1px) rotate(-45deg);
      }
      input[type='radio']:checked::after {
        width: 0.35rem;
        height: 0.35rem;
        border: 0;
        border-radius: 50%;
        background: var(--ep-accent-on);
        transform: none;
      }
      input:focus-visible {
        outline: 2px solid var(--ep-accent);
        outline-offset: 2px;
      }
      .name {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .count {
        font-size: var(--ep-text-xs);
        color: var(--ep-muted);
        font-variant-numeric: tabular-nums;
      }
      .toggle {
        margin-top: 0.4rem;
        border: 0;
        background: none;
        padding: 0.2rem 0;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        color: var(--ep-accent-text);
        cursor: pointer;
      }
      .toggle:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
      .empty {
        font-size: var(--ep-text-xs);
        color: var(--ep-muted);
      }
    `,
  ];

  constructor() {
    super();
    this.expanded = false;
    this.query = '';
    this.relationOptions = null;
    new StoreController(this, this.services.search);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.filter?.type === 'relation' && this.filter.source) {
      this.services.catalog
        .relationOptions(this.filter.source, this.filter.valueType)
        .then((options) => (this.relationOptions = options))
        .catch(() => (this.relationOptions = []));
    }
  }

  get #source(): string {
    return this.filter.source ?? '';
  }

  #options(): Array<FacetOption & { count?: number }> {
    const { search, catalog } = this.services;
    const counts = search.state.results.facets[this.#source];
    const selected = new Set(search.state.query.facets[this.#source] ?? []);
    let labels: Map<string, string>;
    if (this.filter.type === 'relation') {
      labels = new Map((this.relationOptions ?? []).map((o) => [o.id, o.label]));
    } else {
      labels = catalog.fieldDefinitions().get(this.#source)?.options ?? new Map();
    }
    const ids = counts ? [...counts.keys()] : [...labels.keys()];
    for (const id of selected) if (!ids.includes(id)) ids.push(id);
    return ids
      .map((id) => ({ id, label: labels.get(id) ?? id, count: counts?.get(id) }))
      .filter((o) => selected.has(o.id) || o.count === undefined || o.count > 0)
      .sort((a, b) => {
        const sa = selected.has(a.id) ? 1 : 0;
        const sb = selected.has(b.id) ? 1 : 0;
        if (sa !== sb) return sb - sa;
        return (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label);
      });
  }

  #toggle(id: string, checked: boolean) {
    const { search } = this.services;
    const current = search.state.query.facets[this.#source] ?? [];
    const values = this.filter.radio
      ? checked
        ? [id]
        : []
      : checked
        ? [...current, id]
        : current.filter((v) => v !== id);
    search.update({ facets: { ...search.state.query.facets, [this.#source]: values } });
  }

  override render() {
    const selected = new Set(this.services.search.state.query.facets[this.#source] ?? []);
    let options = this.#options();
    const total = options.length;
    if (this.query) {
      const q = this.query.toLowerCase();
      options = options.filter((o) => o.label.toLowerCase().includes(q));
    }
    const visible =
      this.expanded || this.query ? options : options.slice(0, Math.max(VISIBLE, selected.size));
    if (!total) return html`<p class="empty">${this.t('filters.none')}</p>`;
    return html`
      ${
        total > 10 && this.expanded
          ? html`<wa-input
              class="search"
              size="s"
              type="search"
              placeholder=${this.t('filters.search')}
              .value=${this.query}
              @input=${(e: Event) => (this.query = (e.target as HTMLInputElement).value)}
            >
              <wa-icon slot="start" name="search"></wa-icon>
            </wa-input>`
          : nothing
      }
      <ul>
        ${visible.map(
          (option) =>
            html`<li>
              <label>
                <input
                  type=${this.filter.radio ? 'radio' : 'checkbox'}
                  name=${this.#source}
                  .checked=${selected.has(option.id)}
                  @change=${(e: Event) => this.#toggle(option.id, (e.target as HTMLInputElement).checked)}
                />
                <span class="name" title=${option.label}>${option.label}</span>
                ${
                  option.count !== undefined
                    ? html`<span class="count">${this.services.i18n.number(option.count)}</span>`
                    : nothing
                }
              </label>
            </li>`,
        )}
      </ul>
      ${
        total > VISIBLE && !this.query
          ? html`<button
              type="button"
              class="toggle"
              @click=${() => (this.expanded = !this.expanded)}
              aria-expanded=${this.expanded}
            >
              ${this.expanded ? this.t('filters.less') : this.t('filters.more', { count: total })}
            </button>`
          : nothing
      }
    `;
  }
}

customElements.define('ep-facet-filter', EpFacetFilter);
