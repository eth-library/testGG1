import { css, html, nothing, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController, storage } from '../../state/store.ts';
import type { Asset, AssetDetail, FieldValue, MetadataField, RelationType } from '../../data/model.ts';
import { contactHref, permalink, share } from '../../features/share.ts';
import './ep-download-menu.ts';

const FOLD_KEY = 'ep-detail-folded';
const CLAMP = 320;

/** Escaped Text mit automatisch verlinkten URLs und E-Mail-Adressen. */
export function linkify(text: string): TemplateResult {
  const parts = text.split(/(https?:\/\/[^\s<>"]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g);
  return html`${parts.map((part, i) => {
    if (i % 2 === 0) return part;
    const href = part.includes('@') && !part.startsWith('http') ? `mailto:${part}` : part;
    const label = part.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return html`<a href=${href} target="_blank" rel="noopener"
      >${label.length > 48 ? `${label.slice(0, 45)}…` : label}</a
    >`;
  })}`;
}

/** Erlaubt nur einfache Auszeichnungen in HTML-Feldern. */
function sanitize(htmlText: string): string {
  const template = document.createElement('template');
  template.innerHTML = htmlText;
  const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'P', 'UL', 'OL', 'LI', 'A', 'SPAN']);
  const walk = (node: Element) => {
    for (const child of [...node.children]) {
      if (!allowed.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      for (const attr of [...child.attributes]) {
        if (!(child.tagName === 'A' && attr.name === 'href' && /^(https?:|mailto:)/.test(attr.value))) {
          child.removeAttribute(attr.name);
        }
      }
      if (child.tagName === 'A') child.setAttribute('target', '_blank');
      walk(child);
    }
  };
  walk(template.content as unknown as Element);
  return template.innerHTML;
}

/** Informationsspalte der Detailansicht: Titel, Aktionen, Metadaten, Sammlungen, Verwandtes. */
export class EpAssetInfo extends EpElement {
  static override properties = {
    asset: { attribute: false },
    related: { attribute: false },
    folded: { state: true },
    expanded: { state: true },
  };

  declare asset: AssetDetail;
  declare related: Array<{ type: RelationType; assets: Asset[] }>;
  declare folded: Record<string, boolean>;
  declare expanded: Set<string>;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
        color: var(--ep-text);
      }
      .eyebrow {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem 0.75rem;
        margin: 0 0 0.85rem;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ep-muted);
      }
      h1 {
        margin: 0;
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: clamp(1.75rem, 1.3rem + 1.2vw, 2.5rem);
        line-height: 1.08;
        letter-spacing: -0.01em;
        text-wrap: balance;
      }
      .byline {
        margin: 0.75rem 0 0;
        color: var(--ep-muted);
        font-size: var(--ep-text-m);
      }
      .lead {
        margin: 1.1rem 0 0;
        font-size: var(--ep-text-m);
        line-height: 1.65;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 1.5rem 0 0.25rem;
      }
      .license {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        margin-top: 1.25rem;
        padding: 0.45rem 0.8rem;
        border-radius: var(--ep-radius-m);
        background: var(--ep-accent-soft);
        font-size: var(--ep-text-s);
      }
      .notice {
        margin-top: 1rem;
        font-size: var(--ep-text-s);
        color: var(--ep-muted);
      }
      .cats {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-top: 1.25rem;
      }
      .cats a {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.3rem 0.7rem;
        border-radius: 999px;
        border: 1px solid var(--ep-border);
        font-size: var(--ep-text-xs);
        text-decoration: none;
        color: var(--ep-text);
        transition: border-color var(--ep-dur-fast);
      }
      .cats a:hover {
        border-color: var(--ep-border-strong);
      }
      section.group {
        border-top: 1px solid var(--ep-border);
      }
      section.group:first-of-type {
        margin-top: 2rem;
      }
      .group-head {
        display: flex;
        align-items: center;
        width: 100%;
        border: 0;
        background: none;
        padding: 1rem 0;
        font: inherit;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ep-muted);
        cursor: pointer;
        text-align: left;
      }
      .group-head wa-icon {
        margin-left: auto;
        transition: transform var(--ep-dur) var(--ep-ease);
      }
      .group-head[aria-expanded='true'] wa-icon {
        transform: rotate(180deg);
      }
      dl {
        display: grid;
        grid-template-columns: minmax(7rem, 34%) 1fr;
        gap: 0.65rem 1rem;
        margin: 0 0 1.25rem;
        font-size: var(--ep-text-s);
        line-height: 1.5;
      }
      dt {
        color: var(--ep-muted);
      }
      dt abbr {
        text-decoration: underline dotted;
        text-underline-offset: 3px;
        cursor: help;
      }
      dd {
        margin: 0;
        min-width: 0;
        overflow-wrap: anywhere;
      }
      dd a {
        color: var(--ep-accent-text);
      }
      .values {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
      }
      a.value {
        display: inline-flex;
        padding: 0.12rem 0.55rem;
        border-radius: 999px;
        background: var(--ep-lowered);
        color: var(--ep-text);
        text-decoration: none;
        font-size: var(--ep-text-s);
        transition: background var(--ep-dur-fast);
      }
      a.value:hover {
        background: var(--ep-accent-soft);
        color: var(--ep-accent-text);
      }
      .more {
        border: 0;
        background: none;
        padding: 0;
        margin-top: 0.25rem;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        color: var(--ep-accent-text);
        cursor: pointer;
      }
      .related {
        border-top: 1px solid var(--ep-border);
        padding-top: 1.25rem;
        margin-top: 0.5rem;
      }
      .related h2 {
        margin: 0 0 0.75rem;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ep-muted);
      }
      .strip {
        display: flex;
        gap: 0.5rem;
        overflow-x: auto;
        padding-bottom: 0.5rem;
        scroll-snap-type: x mandatory;
        scrollbar-width: thin;
      }
      .strip a {
        flex: none;
        width: 6.5rem;
        height: 5rem;
        border-radius: var(--ep-radius-s);
        overflow: hidden;
        background: var(--ep-placeholder);
        scroll-snap-align: start;
      }
      .strip img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform var(--ep-dur) var(--ep-ease);
      }
      .strip a:hover img {
        transform: scale(1.06);
      }
      .footer {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1.25rem;
        margin-top: 1.5rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--ep-border);
        font-size: var(--ep-text-xs);
      }
      .footer a,
      .footer button {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        border: 0;
        background: none;
        padding: 0;
        font: inherit;
        color: var(--ep-muted);
        text-decoration: none;
        cursor: pointer;
      }
      .footer a:hover,
      .footer button:hover {
        color: var(--ep-text);
      }
      .html :is(p, ul, ol) {
        margin: 0 0 0.5rem;
      }
    `,
  ];

  constructor() {
    super();
    this.related = [];
    this.folded = storage.get<Record<string, boolean>>(FOLD_KEY, {});
    this.expanded = new Set();
    new StoreController(this, this.services.basket);
  }

  #toggleGroup(id: string, folded: boolean) {
    this.folded = { ...this.folded, [id]: !folded };
    storage.set(FOLD_KEY, this.folded);
  }

  #searchHref(field: string, value: FieldValue): string | null {
    const { config, catalog } = this.services;
    if (!config.detail.drillDownFields.includes(field)) return null;
    const def = catalog.fieldDefinitions().get(field);
    const params = new URLSearchParams();
    if (value.id && def?.type === 'list') params.append(`f.${field}`, value.id);
    else params.set(`t.${field}`, `Equals:${value.raw ?? value.label}`);
    return this.href('/suche', params);
  }

  #value(field: MetadataField) {
    if (field.html)
      return html`<div class="html">
        ${unsafeHTML(sanitize(field.values.map((v) => v.label).join('<br>')))}
      </div>`;
    const links = field.values.map((v) => ({ v, href: this.#searchHref(field.id, v) }));
    if (links.some((l) => l.href)) {
      return html`<div class="values">
        ${links.map(({ v, href }) =>
          href
            ? html`<a class="value" href=${href} title=${this.t('detail.searchFor', { value: v.label })}
                >${v.label}</a
              >`
            : html`<span>${v.label}</span>`,
        )}
      </div>`;
    }
    const text = field.values.map((v) => v.label).join(', ');
    if (text.length > CLAMP && !this.expanded.has(field.id)) {
      return html`${linkify(`${text.slice(0, CLAMP)}…`)}
        <div>
          <button
            type="button"
            class="more"
            @click=${() => (this.expanded = new Set([...this.expanded, field.id]))}
          >
            ${this.t('detail.showMore')}
          </button>
        </div>`;
    }
    return linkify(text);
  }

  #license() {
    const { config } = this.services;
    const license = config.fields.license ? this.asset.fields[config.fields.license]?.[0]?.label : undefined;
    if (!license) return nothing;
    const open = /public domain|cc0|cc by|gemeinfrei/i.test(license);
    return html`<div class="license"><wa-icon name=${open ? 'check' : 'info'}></wa-icon>${license}</div>`;
  }

  override render() {
    const asset = this.asset;
    if (!asset) return nothing;
    const { config, basket } = this.services;
    const fields = config.fields;
    const signature = fields.signature ? asset.fields[fields.signature]?.[0]?.label : undefined;
    const creator = fields.creator ? asset.fields[fields.creator]?.map((v) => v.label).join(', ') : undefined;
    const descriptionField = asset.groups.flatMap((g) => g.fields).find((f) => /desc|beschreib/i.test(f.id));
    const description = descriptionField?.values.map((v) => v.label).join(' ');
    const skip = new Set([fields.title, descriptionField?.id].filter(Boolean));
    const inBasket = basket.has(asset.id);
    const folded = new Set(config.detail.foldedGroups);
    const report = config.detail.reportIssue;
    return html`
      <p class="eyebrow">
        ${signature ? html`<span>${signature}</span>` : nothing}
        ${asset.date ? html`<span>${asset.date}</span>` : nothing}
      </p>
      <h1>${asset.title || this.t('common.untitled')}</h1>
      ${creator ? html`<p class="byline">${creator}</p>` : nothing}
      ${description ? html`<p class="lead">${linkify(description)}</p>` : nothing}
      <div class="actions">
        ${
          config.basket.enabled
            ? html`<wa-button
                pill
                size="s"
                appearance=${inBasket ? 'filled' : 'outlined'}
                @click=${() => basket.toggle(asset)}
                aria-pressed=${inBasket ? 'true' : 'false'}
              >
                <wa-icon slot="start" name=${inBasket ? 'bookmark-check' : 'bookmark-plus'}></wa-icon>
                ${inBasket ? this.t('detail.inBasket') : this.t('detail.addToBasket')}
              </wa-button>`
            : nothing
        }
        <ep-download-menu .asset=${asset}></ep-download-menu>
        <wa-button
          pill
          size="s"
          appearance="outlined"
          @click=${() => share(asset.title, permalink(asset.id))}
          title=${this.t('detail.share')}
        >
          <wa-icon name="share" label=${this.t('detail.share')}></wa-icon>
        </wa-button>
      </div>
      ${this.#license()}
      ${!asset.downloadable ? html`<p class="notice">${this.t('detail.orderRequired')}</p>` : nothing}
      ${
        asset.categories.length
          ? html`<div class="cats" aria-label=${this.t('detail.categories')}>
              ${asset.categories.map(
                (c) =>
                  html`<a href=${this.href(`/sammlung/${encodeURIComponent(c.id)}`)}
                    ><wa-icon name="folder"></wa-icon>${c.path}</a
                  >`,
              )}
            </div>`
          : nothing
      }
      ${asset.groups.map((group) => {
        const visible = group.fields.filter((f) => !skip.has(f.id));
        if (!visible.length) return nothing;
        const isFolded = this.folded[group.id] ?? folded.has(group.id);
        return html`<section class="group">
          <button
            type="button"
            class="group-head"
            aria-expanded=${isFolded ? 'false' : 'true'}
            @click=${() => this.#toggleGroup(group.id, isFolded)}
          >
            ${group.label || this.t('detail.metadata')}
            <wa-icon name="chevron-down"></wa-icon>
          </button>
          ${
            isFolded
              ? nothing
              : html`<dl>
                  ${visible.map(
                    (field) =>
                      html`<dt>
                          ${field.description ? html`<abbr title=${field.description}>${field.label}</abbr>` : field.label}
                        </dt>
                        <dd>${this.#value(field)}</dd>`,
                  )}
                </dl>`
          }
        </section>`;
      })}
      ${this.related.map(
        (rel) =>
          html`<div class="related">
            <h2>${rel.type.label}</h2>
            <div class="strip">
              ${rel.assets.map(
                (a) =>
                  html`<a
                    href=${this.href(`/bild/${encodeURIComponent(a.id)}`)}
                    data-overlay="true"
                    title=${a.title}
                  >
                    <img src=${a.thumbnail} alt=${a.title} loading="lazy" />
                  </a>`,
              )}
            </div>
          </div>`,
      )}
      <div class="footer">
        <button type="button" @click=${() => share(asset.title, permalink(asset.id), true)}>
          <wa-icon name="link"></wa-icon>${this.t('detail.permalink')}
        </button>
        ${
          asset.coordinates && config.map.enabled
            ? html`<a href=${this.href('/karte', { focus: asset.id })}
                ><wa-icon name="map-pin"></wa-icon>${this.t('map.open')}</a
              >`
            : nothing
        }
        ${
          report
            ? html`<a
                href=${contactHref(report, { id: asset.id, title: asset.title, signature })}
                target=${report.mode === 'url' ? '_blank' : '_self'}
              >
                <wa-icon name="mail"></wa-icon>${this.t('detail.reportIssue')}
              </a>`
            : nothing
        }
      </div>
    `;
  }
}

customElements.define('ep-asset-info', EpAssetInfo);
