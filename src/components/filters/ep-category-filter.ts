import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import { categories } from '../../data/categories.ts';
import type { CategoryNode } from '../../data/model.ts';

/**
 * Sammlungsfilter als Drill-down: Pfad (Brotkrumen) der gewählten Sammlung, darunter ihre
 * Untersammlungen. Dazu eine Suche über alle Sammlungen.
 */
export class EpCategoryFilter extends EpElement {
  static override properties = {
    path: { state: true },
    nodes: { state: true },
    query: { state: true },
    hits: { state: true },
    loading: { state: true },
  };

  declare path: CategoryNode[];
  declare nodes: CategoryNode[];
  declare query: string;
  declare hits: CategoryNode[] | null;
  declare loading: boolean;

  #loadedFor = '';
  #timer?: number;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
      }
      .crumbs {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.15rem 0.25rem;
        margin-bottom: 0.5rem;
        font-size: var(--ep-text-xs);
        color: var(--ep-muted);
      }
      .crumbs button {
        border: 0;
        background: none;
        padding: 0.1rem 0;
        font: inherit;
        color: inherit;
        cursor: pointer;
      }
      .crumbs button:hover {
        color: var(--ep-text);
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .crumbs wa-icon {
        font-size: 0.7rem;
      }
      .current {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        padding: 0.45rem 0.4rem 0.45rem 0.7rem;
        margin-bottom: 0.4rem;
        border-radius: var(--ep-radius-s);
        background: var(--ep-accent-soft);
        font-size: var(--ep-text-s);
        font-weight: 600;
      }
      .current button {
        display: grid;
        place-items: center;
        border: 0;
        background: none;
        border-radius: 50%;
        width: 1.6rem;
        height: 1.6rem;
        color: var(--ep-muted);
        cursor: pointer;
      }
      .current button:hover {
        background: var(--ep-hover);
        color: var(--ep-text);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      li button {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        width: 100%;
        border: 0;
        background: none;
        padding: 0.38rem 0.45rem;
        margin: 0 -0.45rem;
        border-radius: var(--ep-radius-s);
        font: inherit;
        font-size: var(--ep-text-s);
        text-align: left;
        color: var(--ep-text);
        cursor: pointer;
        transition: background var(--ep-dur-fast);
      }
      li button:hover {
        background: var(--ep-hover);
      }
      li wa-icon {
        color: var(--ep-muted);
        flex-shrink: 0;
      }
      li .label {
        flex: 1;
        line-height: 1.3;
      }
      li .chev {
        opacity: 0.5;
        font-size: 0.8rem;
      }
      .search {
        margin-top: 0.6rem;
      }
      .hint {
        font-size: var(--ep-text-xs);
        color: var(--ep-muted);
        padding: 0.3rem 0;
      }
    `,
  ];

  constructor() {
    super();
    this.path = [];
    this.nodes = [];
    this.query = '';
    this.hits = null;
    this.loading = false;
    new StoreController(this, this.services.search);
  }

  protected override willUpdate(): void {
    const current = this.services.search.state.query.category ?? categories.root();
    const key = `${this.services.i18n.locale}|${current}`;
    if (key !== this.#loadedFor) {
      this.#loadedFor = key;
      void this.#load(current, key);
      // Sprachwechsel: offene Trefferliste der Sammlungssuche neu anfragen.
      if (this.hits && this.query) this.#onSearch(this.query);
    }
  }

  async #load(id: string, key: string) {
    this.loading = true;
    try {
      const [path, children] = await Promise.all([
        id === categories.root() ? Promise.resolve([]) : categories.path(id),
        categories.children(id),
      ]);
      if (key !== this.#loadedFor) return;
      this.path = path.filter((p) => p.id !== categories.root());
      this.nodes = children;
    } catch {
      this.nodes = [];
    } finally {
      this.loading = false;
    }
  }

  #select(id?: string) {
    const root = categories.root();
    const { search, router } = this.services;
    const target = id && id !== root ? id : undefined;
    if (router.location.route.name === 'collection' && !target) {
      // Sammlungsseite verlassen → allgemeine Suche mit übrigem Zustand.
      router.navigate(this.href('/suche', router.location.query));
      return;
    }
    search.update({ category: target });
  }

  #onSearch(value: string) {
    this.query = value;
    window.clearTimeout(this.#timer);
    if (value.trim().length < 2) {
      this.hits = null;
      return;
    }
    this.#timer = window.setTimeout(async () => {
      let hits: CategoryNode[];
      try {
        hits = await this.services.catalog.searchCategories(value, categories.root());
      } catch {
        hits = [];
      }
      // Nur übernehmen, wenn die Eingabe inzwischen nicht geändert oder geleert wurde.
      if (this.query === value) this.hits = hits;
    }, 220);
  }

  override render() {
    const current = this.path.at(-1);
    const list = this.hits ?? this.nodes;
    return html`
      ${
        current
          ? html`
              <nav class="crumbs" aria-label=${this.t('filters.category')}>
                <button type="button" @click=${() => this.#select()}>${this.t('collection.all')}</button>
                ${this.path
                  .slice(0, -1)
                  .map(
                    (node) =>
                      html`<wa-icon name="chevron-right"></wa-icon>
                        <button type="button" @click=${() => this.#select(node.id)}>${node.name}</button>`,
                  )}
              </nav>
              <div class="current">
                <span>${current.name}</span>
                <button
                  type="button"
                  aria-label=${this.t('filters.resetOne', { name: current.name })}
                  @click=${() => this.#select(this.path.at(-2)?.id)}
                >
                  <wa-icon name="x"></wa-icon>
                </button>
              </div>
            `
          : nothing
      }
      ${
        list.length
          ? html`<ul>
              ${list.map(
                (node) =>
                  html`<li>
                    <button
                      type="button"
                      @click=${() => ((this.query = ''), (this.hits = null), this.#select(node.id))}
                    >
                      <wa-icon name=${node.hasChildren ? 'folder' : 'images'}></wa-icon>
                      <span class="label">${node.name}</span>
                      ${node.hasChildren ? html`<wa-icon class="chev" name="chevron-right"></wa-icon>` : nothing}
                    </button>
                  </li>`,
              )}
            </ul>`
          : this.hits
            ? html`<p class="hint">${this.t('filters.none')}</p>`
            : nothing
      }
      <wa-input
        class="search sr-label"
        size="s"
        type="search"
        label=${this.t('filters.categorySearch')}
        placeholder=${this.t('filters.categorySearch')}
        .value=${this.query}
        @input=${(e: Event) => this.#onSearch((e.target as HTMLInputElement).value)}
      >
        <wa-icon slot="start" name="search"></wa-icon>
      </wa-input>
    `;
  }
}

customElements.define('ep-category-filter', EpCategoryFilter);
