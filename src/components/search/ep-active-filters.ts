import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import { categories } from '../../data/categories.ts';
import { activeFilterCount, type SearchState } from '../../state/search-state.ts';

interface Chip {
  key: string;
  label: string;
  group?: string;
  remove: () => Partial<SearchState>;
}

/** Aktive Filter als entfernbare Chips. */
export class EpActiveFilters extends EpElement {
  static override properties = { categoryName: { state: true }, relationLabels: { state: true } };
  declare categoryName: string;
  declare relationLabels: Map<string, string>;
  #categoryFor = '';

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        align-items: center;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        max-width: 22rem;
        height: 1.9rem;
        padding: 0 0.3rem 0 0.75rem;
        border-radius: 999px;
        border: 1px solid var(--ep-border);
        background: var(--ep-surface);
        font-size: var(--ep-text-xs);
        animation: pop var(--ep-dur) var(--ep-ease);
      }
      @keyframes pop {
        from {
          opacity: 0;
          transform: scale(0.94);
        }
      }
      .group {
        color: var(--ep-muted);
      }
      .label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: 500;
      }
      .chip button {
        display: grid;
        place-items: center;
        width: 1.35rem;
        height: 1.35rem;
        border: 0;
        border-radius: 50%;
        background: var(--ep-hover);
        color: var(--ep-muted);
        cursor: pointer;
        flex-shrink: 0;
      }
      .chip button:hover {
        background: var(--ep-text);
        color: var(--ep-bg);
      }
      .chip button wa-icon {
        font-size: 0.75rem;
      }
      .clear {
        border: 0;
        background: none;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        color: var(--ep-accent-text);
        cursor: pointer;
        padding: 0.3rem 0.4rem;
      }
      .clear:hover {
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    `,
  ];

  constructor() {
    super();
    this.categoryName = '';
    this.relationLabels = new Map();
    new StoreController(this, this.services.search);
  }

  protected override willUpdate(): void {
    const { search, router, catalog } = this.services;
    const cat = search.state.query.category;
    if (cat && cat !== this.#categoryFor && router.location.route.name !== 'collection') {
      this.#categoryFor = cat;
      categories
        .node(cat)
        .then((node) => (this.categoryName = node.name))
        .catch(() => (this.categoryName = cat));
    }
    for (const source of Object.keys(search.state.query.facets)) {
      const rel = catalog.relationTypes().get(source);
      if (rel && !this.relationLabels.has(`${source}:*`)) {
        this.relationLabels.set(`${source}:*`, '');
        const filter = search.filters.find((f) => f.source === source);
        catalog.relationOptions(source, filter?.valueType).then((options) => {
          const next = new Map(this.relationLabels);
          for (const o of options) next.set(`${source}:${o.id}`, o.label);
          this.relationLabels = next;
        });
      }
    }
  }

  #chips(): Chip[] {
    const { search, catalog, router } = this.services;
    const q = search.state.query;
    const defs = catalog.fieldDefinitions();
    const rels = catalog.relationTypes();
    const chips: Chip[] = [];
    if (q.category && router.location.route.name !== 'collection') {
      chips.push({
        key: 'cat',
        group: this.t('filters.category'),
        label: this.categoryName || '…',
        remove: () => ({ category: undefined }),
      });
    }
    for (const [source, values] of Object.entries(q.facets)) {
      const def = defs.get(source);
      const group = def?.label ?? rels.get(source)?.label ?? source;
      for (const value of values) {
        chips.push({
          key: `f:${source}:${value}`,
          group,
          label: def?.options.get(value) ?? this.relationLabels.get(`${source}:${value}`) ?? value,
          remove: () => ({ facets: { ...q.facets, [source]: q.facets[source].filter((v) => v !== value) } }),
        });
      }
    }
    for (const [source, range] of Object.entries(q.dates)) {
      const fmt = (d?: string) =>
        d ? (d.endsWith('-01-01') || d.endsWith('-12-31') ? d.slice(0, 4) : d) : '…';
      chips.push({
        key: `d:${source}`,
        group: defs.get(source)?.label ?? source,
        label: `${fmt(range.from)} – ${fmt(range.to)}`,
        remove: () => {
          const dates = { ...q.dates };
          delete dates[source];
          return { dates };
        },
      });
    }
    for (const [source, text] of Object.entries(q.texts)) {
      chips.push({
        key: `t:${source}`,
        group: defs.get(source)?.label ?? source,
        label: `${this.t(`filters.op.${text.op}` as 'filters.op.Contains')} «${text.value}»`,
        remove: () => {
          const texts = { ...q.texts };
          delete texts[source];
          return { texts };
        },
      });
    }
    if (q.geo) {
      chips.push({ key: 'geo', label: this.t('filters.geo'), remove: () => ({ geo: undefined }) });
    }
    return chips;
  }

  override render() {
    const chips = this.#chips();
    if (!chips.length) return nothing;
    const { search } = this.services;
    return html`<ul aria-label=${this.t('filters.active')}>
      ${chips.map(
        (chip) =>
          html`<li class="chip">
            ${chip.group ? html`<span class="group">${chip.group}:</span>` : nothing}
            <span class="label" title=${chip.label}>${chip.label}</span>
            <button
              type="button"
              aria-label=${this.t('filters.resetOne', { name: chip.label })}
              @click=${() => search.update(chip.remove())}
            >
              <wa-icon name="x"></wa-icon>
            </button>
          </li>`,
      )}
      ${
        activeFilterCount(search.state.query) > 1
          ? html`<li>
              <button type="button" class="clear" @click=${() => search.reset()}>
                ${this.t('filters.reset')}
              </button>
            </li>`
          : nothing
      }
    </ul>`;
  }
}

customElements.define('ep-active-filters', EpActiveFilters);
