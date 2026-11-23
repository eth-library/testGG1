import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { categories } from '../../data/categories.ts';
import type { CategoryInfo, CategoryNode } from '../../data/model.ts';
import './ep-collection-card.ts';

interface Entry {
  node: CategoryInfo;
  children: CategoryNode[];
}

/** Übersicht aller Sammlungen (erste Ebene unter der Wurzel) mit Untersammlungen. */
export class EpCollectionsPage extends EpElement {
  static override properties = { entries: { state: true }, loading: { state: true } };
  declare entries: Entry[];
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
        padding: clamp(2.5rem, 6vw, 4.5rem) 0 clamp(2rem, 4vw, 3rem);
        max-width: 60rem;
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
        font-size: var(--ep-display-l);
        line-height: 0.95;
        letter-spacing: -0.02em;
      }
      .list {
        display: grid;
        gap: clamp(2.5rem, 5vw, 4rem);
      }
      article {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
        gap: clamp(1.25rem, 3vw, 3rem);
        align-items: stretch;
      }
      article:nth-child(even) {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);
      }
      article:nth-child(even) ep-collection-card {
        order: 2;
      }
      ep-collection-card {
        min-height: clamp(16rem, 32vw, 26rem);
      }
      .info {
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 1rem;
      }
      .info h2 {
        margin: 0;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: var(--ep-display-s);
        line-height: 1.05;
      }
      .info h2 a {
        color: inherit;
        text-decoration: none;
      }
      .info h2 a:hover {
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 6px;
      }
      .info p {
        margin: 0;
        color: var(--ep-muted);
        line-height: 1.6;
        max-width: 52ch;
      }
      .subs {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .subs a {
        padding: 0.35rem 0.85rem;
        border-radius: 999px;
        border: 1px solid var(--ep-border);
        font-size: var(--ep-text-s);
        color: var(--ep-text);
        text-decoration: none;
        transition: border-color var(--ep-dur-fast);
      }
      .subs a:hover {
        border-color: var(--ep-border-strong);
      }
      .skeleton {
        height: 22rem;
        border-radius: var(--ep-radius-m);
        background: var(--ep-placeholder);
      }
      @media (max-width: 820px) {
        article,
        article:nth-child(even) {
          grid-template-columns: 1fr;
        }
        article:nth-child(even) ep-collection-card {
          order: 0;
        }
      }
    `,
  ];

  constructor() {
    super();
    this.entries = [];
    this.loading = true;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.title = `${this.t('nav.collections')} – ${this.pick(this.services.config.branding.name)}`;
    void this.#load();
  }

  async #load() {
    try {
      const top = await categories.children(categories.root());
      this.entries = await Promise.all(
        top.map(async (node) => ({
          node: await categories.node(node.id).catch(() => ({ ...node, fields: [] })),
          children: node.hasChildren ? await categories.children(node.id).catch(() => []) : [],
        })),
      );
    } finally {
      this.loading = false;
    }
  }

  override render() {
    return html`<div class="wrap">
      <header>
        <p class="eyebrow">${this.pick(this.services.config.catalog.title)}</p>
        <h1>${this.t('nav.collections')}</h1>
      </header>
      <div class="list">
        ${
          this.loading
            ? html`<div class="skeleton"></div>
                <div class="skeleton"></div>`
            : this.entries.map(
                ({ node, children }) =>
                  html`<article>
                    <ep-collection-card .node=${node}></ep-collection-card>
                    <div class="info">
                      <h2>
                        <a href=${this.href(`/sammlung/${encodeURIComponent(node.id)}`)}>${node.name}</a>
                      </h2>
                      ${node.description ? html`<p>${node.description}</p>` : nothing}
                      ${
                        children.length
                          ? html`<div class="subs" aria-label=${this.t('collection.sub')}>
                              ${children.map((c) => html`<a href=${this.href(`/sammlung/${encodeURIComponent(c.id)}`)}>${c.name}</a>`)}
                            </div>`
                          : nothing
                      }
                    </div>
                  </article>`,
              )
        }
      </div>
    </div>`;
  }
}

customElements.define('ep-collections-page', EpCollectionsPage);
