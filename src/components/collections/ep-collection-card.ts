import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import type { CategoryNode } from '../../data/model.ts';

/** Grosse Bildkachel für eine Sammlung (Kategorie). */
export class EpCollectionCard extends EpElement {
  static override properties = {
    node: { attribute: false },
    large: { type: Boolean, reflect: true },
    meta: {},
  };

  declare node: CategoryNode & { description?: string };
  declare large: boolean;
  declare meta?: string;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
        min-height: 100%;
      }
      a {
        position: relative;
        display: block;
        height: 100%;
        min-height: 12rem;
        overflow: hidden;
        border-radius: var(--ep-radius-m);
        background: var(--ep-placeholder);
        color: #fff;
        text-decoration: none;
        isolation: isolate;
      }
      img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        z-index: -1;
        transition:
          transform 1.2s var(--ep-ease),
          filter var(--ep-dur) var(--ep-ease);
      }
      a:hover img,
      a:focus-visible img {
        transform: scale(1.05);
      }
      .shade {
        position: absolute;
        inset: 0;
        background: linear-gradient(to top, rgb(0 0 0 / 0.72) 0%, rgb(0 0 0 / 0.18) 45%, transparent 70%);
        z-index: -1;
      }
      .text {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: clamp(1rem, 2vw, 1.5rem);
      }
      h3 {
        margin: 0;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: clamp(1.35rem, 1rem + 1vw, 1.9rem);
        line-height: 1.05;
        letter-spacing: -0.01em;
      }
      :host([large]) h3 {
        font-size: clamp(2rem, 1.3rem + 2vw, 3.2rem);
      }
      p {
        margin: 0.5rem 0 0;
        max-width: 44ch;
        font-size: var(--ep-text-s);
        line-height: 1.5;
        opacity: 0.86;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .arrow {
        position: absolute;
        top: 1rem;
        right: 1rem;
        display: grid;
        place-items: center;
        width: 2.4rem;
        height: 2.4rem;
        border-radius: 50%;
        background: rgb(255 255 255 / 0.16);
        backdrop-filter: blur(8px);
        opacity: 0;
        transform: translate(-4px, 4px);
        transition:
          opacity var(--ep-dur) var(--ep-ease),
          transform var(--ep-dur) var(--ep-ease);
      }
      a:hover .arrow,
      a:focus-visible .arrow {
        opacity: 1;
        transform: none;
      }
      .meta {
        margin-top: 0.5rem;
        font-size: var(--ep-text-xs);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        opacity: 0.75;
      }
    `,
  ];

  constructor() {
    super();
    this.large = false;
  }

  override render() {
    const node = this.node;
    if (!node) return nothing;
    return html`<a href=${this.href(`/sammlung/${encodeURIComponent(node.id)}`)}>
      ${node.thumbnail ? html`<img src=${node.thumbnail} alt="" loading="lazy" />` : nothing}
      <span class="shade"></span>
      <span class="arrow" aria-hidden="true"><wa-icon name="arrow-up-right"></wa-icon></span>
      <span class="text">
        <h3>${node.name}</h3>
        ${this.large && node.description ? html`<p>${node.description}</p>` : nothing}
        ${this.meta ? html`<div class="meta">${this.meta}</div>` : nothing}
      </span>
    </a>`;
  }
}

customElements.define('ep-collection-card', EpCollectionCard);
