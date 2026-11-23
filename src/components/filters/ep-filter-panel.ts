import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController, storage } from '../../state/store.ts';
import { activeFilterCount } from '../../state/search-state.ts';
import type { FilterConfig } from '../../config/schema.ts';
import './ep-facet-filter.ts';
import './ep-date-filter.ts';
import './ep-text-filter.ts';
import './ep-category-filter.ts';

const OPEN_KEY = 'ep-filter-open';

/** Filterspalte: einklappbare Abschnitte je Filter, «Filter hinzufügen», «Alle zurücksetzen». */
export class EpFilterPanel extends EpElement {
  static override properties = { open: { state: true } };
  declare open: Record<string, boolean>;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
      }
      section {
        border-bottom: 1px solid var(--ep-border);
      }
      section:first-of-type {
        border-top: 1px solid var(--ep-border);
      }
      .head {
        display: flex;
        align-items: center;
        gap: 0.4rem;
      }
      .toggle {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 0.55rem;
        border: 0;
        background: none;
        padding: 0.95rem 0;
        font: inherit;
        font-size: var(--ep-text-s);
        font-weight: 600;
        color: var(--ep-text);
        text-align: left;
        cursor: pointer;
      }
      .toggle .chev {
        margin-left: auto;
        color: var(--ep-muted);
        transition: transform var(--ep-dur) var(--ep-ease);
      }
      .toggle[aria-expanded='true'] .chev {
        transform: rotate(180deg);
      }
      .dot {
        min-width: 1.2rem;
        height: 1.2rem;
        padding: 0 0.35rem;
        border-radius: 999px;
        background: var(--ep-accent);
        color: var(--ep-accent-on);
        font-size: 0.66rem;
        font-weight: 700;
        display: inline-grid;
        place-items: center;
      }
      .remove {
        border: 0;
        background: none;
        color: var(--ep-muted);
        cursor: pointer;
        display: grid;
        place-items: center;
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 50%;
      }
      .remove:hover {
        background: var(--ep-hover);
        color: var(--ep-text);
      }
      .body {
        padding: 0 0 1.1rem;
      }
      .footer {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding-top: 1rem;
      }
      .add-list {
        max-height: 50vh;
        overflow: auto;
      }
    `,
  ];

  constructor() {
    super();
    this.open = storage.get<Record<string, boolean>>(OPEN_KEY, {});
    new StoreController(this, this.services.search);
  }

  #key(filter: FilterConfig) {
    return `${filter.type}:${filter.source ?? ''}`;
  }

  #label(filter: FilterConfig): string {
    if (filter.label) return this.pick(filter.label);
    const { catalog } = this.services;
    if (filter.type === 'category') return this.t('filters.category');
    if (filter.type === 'relation')
      return catalog.relationTypes().get(filter.source ?? '')?.label ?? filter.source ?? '';
    return catalog.fieldDefinitions().get(filter.source ?? '')?.label ?? filter.source ?? '';
  }

  #count(filter: FilterConfig): number {
    const q = this.services.search.state.query;
    const source = filter.source ?? '';
    switch (filter.type) {
      case 'category':
        return q.category ? 1 : 0;
      case 'date':
        return q.dates[source] ? 1 : 0;
      case 'text':
        return q.texts[source]?.value ? 1 : 0;
      default:
        return q.facets[source]?.length ?? 0;
    }
  }

  #toggle(filter: FilterConfig, isOpen: boolean) {
    this.open = { ...this.open, [this.#key(filter)]: !isOpen };
    storage.set(OPEN_KEY, this.open);
  }

  #body(filter: FilterConfig) {
    switch (filter.type) {
      case 'category':
        return html`<ep-category-filter></ep-category-filter>`;
      case 'date':
        return html`<ep-date-filter .filter=${filter}></ep-date-filter>`;
      case 'text':
        return html`<ep-text-filter .filter=${filter}></ep-text-filter>`;
      default:
        return html`<ep-facet-filter .filter=${filter}></ep-facet-filter>`;
    }
  }

  /** Durchsuchbare Felder, die noch nicht als Filter vorhanden sind. */
  #addable(): FilterConfig[] {
    const { catalog, search, config } = this.services;
    if (!config.addableFilters) return [];
    const used = new Set(search.filters.map((f) => f.source));
    const hidden = new Set(config.detail.hiddenFields);
    const result: Array<FilterConfig & { label: string }> = [];
    for (const def of catalog.fieldDefinitions().values()) {
      if (!def.searchable || used.has(def.id) || hidden.has(def.id)) continue;
      const type =
        def.type === 'list'
          ? 'facet'
          : def.type === 'date' || def.type === 'datetime'
            ? 'date'
            : def.type === 'text'
              ? 'text'
              : null;
      if (type) result.push({ type, source: def.id, label: def.label });
    }
    for (const rel of catalog.relationTypes().values()) {
      if (rel.searchable && !used.has(rel.id)) {
        result.push({ type: 'relation', source: rel.id, label: rel.label, valueType: rel.allowed[0]?.from });
      }
    }
    return result.sort((a, b) => a.label.localeCompare(b.label));
  }

  override render() {
    const { search } = this.services;
    const extra = new Set(search.state.extraFilters.map((f) => f.source));
    const configured = new Set(this.services.config.filters.map((f) => f.source));
    const addable = this.#addable();
    const active = activeFilterCount(search.state.query);
    return html`
      ${search.filters.map((filter) => {
        const key = this.#key(filter);
        const isOpen = this.open[key] ?? filter.open ?? false;
        const count = this.#count(filter);
        const label = this.#label(filter);
        const removable = extra.has(filter.source) && !configured.has(filter.source);
        return html`<section>
          <div class="head">
            <button
              type="button"
              class="toggle"
              aria-expanded=${isOpen ? 'true' : 'false'}
              aria-controls="f-${key}"
              @click=${() => this.#toggle(filter, isOpen)}
            >
              <span>${label}</span>
              ${count ? html`<span class="dot" aria-label="${count}">${count}</span>` : nothing}
              <wa-icon class="chev" name="chevron-down"></wa-icon>
            </button>
            ${
              removable
                ? html`<button
                    type="button"
                    class="remove"
                    aria-label=${this.t('filters.resetOne', { name: label })}
                    @click=${() => search.removeFilter(filter.source!)}
                  >
                    <wa-icon name="x"></wa-icon>
                  </button>`
                : nothing
            }
          </div>
          <div class="body" id="f-${key}" ?hidden=${!isOpen}>${isOpen ? this.#body(filter) : nothing}</div>
        </section>`;
      })}
      <div class="footer">
        ${
          addable.length
            ? html`<wa-dropdown
                placement="bottom-start"
                @wa-select=${(e: CustomEvent<{ item: { value: string } }>) => {
                  const filter = addable.find((f) => `${f.type}:${f.source}` === e.detail.item.value);
                  if (filter) {
                    search.addFilter({
                      type: filter.type,
                      source: filter.source,
                      valueType: filter.valueType,
                    });
                    this.open = { ...this.open, [this.#key(filter)]: true };
                  }
                }}
              >
                <wa-button slot="trigger" appearance="outlined" size="s" with-caret>
                  <wa-icon slot="start" name="plus"></wa-icon>${this.t('filters.add')}
                </wa-button>
                ${addable.map(
                  (f) =>
                    html`<wa-dropdown-item value="${f.type}:${f.source}">
                      <wa-icon
                        slot="icon"
                        name=${f.type === 'date' ? 'calendar' : f.type === 'relation' ? 'user' : f.type === 'text' ? 'search' : 'filter'}
                      ></wa-icon>
                      ${this.#label(f)}
                    </wa-dropdown-item>`,
                )}
              </wa-dropdown>`
            : nothing
        }
        ${
          active
            ? html`<wa-button appearance="plain" size="s" @click=${() => search.reset()}>
                <wa-icon slot="start" name="reset"></wa-icon>${this.t('filters.reset')}
              </wa-button>`
            : nothing
        }
      </div>
    `;
  }
}

customElements.define('ep-filter-panel', EpFilterPanel);
