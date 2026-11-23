import { css, html, nothing, type PropertyValues } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import type { Route } from '../../router/router.ts';
import './ep-header.ts';
import './ep-footer.ts';
import './ep-toasts.ts';
import '../home/ep-home-page.ts';
import '../search/ep-search-page.ts';
import '../collections/ep-collections-page.ts';
import '../detail/ep-asset-viewer.ts';
import '../basket/ep-basket-drawer.ts';
import '../basket/ep-selection-page.ts';
import '../map/ep-map-page.ts';
import { matchRoute } from '../../router/router.ts';

/** App-Shell: Kopf, Seiteninhalt je Route, Overlays (Detailansicht, Auswahl), Meldungen. */
export class EpApp extends EpElement {
  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
        --ep-offset: 0px;
      }
      :host([demo]) {
        --ep-offset: calc(1.8625rem + 1px);
      }
      main {
        flex: 1;
        display: block;
        outline: none;
      }
      .skip {
        position: fixed;
        top: 0.75rem;
        left: 0.75rem;
        z-index: 1000;
        padding: 0.6rem 1rem;
        border-radius: var(--ep-radius-m);
        background: var(--ep-accent);
        color: var(--ep-accent-on);
        font-weight: 600;
        text-decoration: none;
        transform: translateY(-200%);
        transition: transform var(--ep-dur) var(--ep-ease);
      }
      .skip:focus {
        transform: none;
      }
      .demo {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        align-items: center;
        padding: 0.35rem var(--ep-gutter);
        font-size: var(--ep-text-xs);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ep-muted);
        background: var(--ep-lowered);
        border-bottom: 1px solid var(--ep-border);
      }
      .not-found {
        max-width: 40rem;
        margin: 0 auto;
        padding: 18vh var(--ep-gutter);
        text-align: center;
      }
      .not-found h1 {
        font-family: var(--ep-font-display);
        font-weight: 400;
        font-size: var(--ep-display-m);
        margin: 0 0 1rem;
      }
    `,
  ];

  #lastPath = '';

  constructor() {
    super();
    new StoreController(this, this.services.router);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.toggleAttribute('demo', this.services.config.api.mock);
    this.services.analytics.pageView();
  }

  protected override updated(_changed: PropertyValues): void {
    const loc = this.services.router.location;
    const path = loc.path + loc.query.toString();
    if (path !== this.#lastPath) {
      const previous = this.#lastPath;
      this.#lastPath = path;
      this.services.analytics.pageView();
      // Bei echtem Seitenwechsel (kein Overlay, keine reine Filteränderung) nach oben bzw. zur gemerkten Position.
      const route = loc.route.name;
      const overlay = route === 'asset' && loc.state.overlayOf;
      if (!overlay && previous && previous.split('?')[0] !== loc.path) {
        const y = loc.state.scrollY;
        if (y === undefined) window.scrollTo({ top: 0 });
      }
    }
  }

  #page(route: Route) {
    switch (route.name) {
      case 'home':
        return html`<ep-home-page></ep-home-page>`;
      case 'search':
        return html`<ep-search-page></ep-search-page>`;
      case 'collection':
        return html`<ep-search-page .collectionId=${route.id}></ep-search-page>`;
      case 'collections':
        return html`<ep-collections-page></ep-collections-page>`;
      case 'map':
        return html`<ep-map-page></ep-map-page>`;
      case 'selection':
        return html`<ep-selection-page></ep-selection-page>`;
      case 'asset':
        return html`<ep-asset-viewer mode="page" .assetId=${route.id}></ep-asset-viewer>`;
      default:
        return html`<section class="not-found">
          <h1>${this.t('app.notFound.title')}</h1>
          <p>${this.t('app.notFound.text')}</p>
          <wa-button variant="brand" href=${this.href('/')}>${this.t('app.backHome')}</wa-button>
        </section>`;
    }
  }

  override render() {
    const { router, config } = this.services;
    const loc = router.location;
    // Detail als Overlay: darunter bleibt die Ausgangsseite stehen.
    let pageRoute: Route = loc.route;
    let overlayId: string | undefined;
    if (loc.route.name === 'asset' && loc.state.overlayOf) {
      const url = new URL(loc.state.overlayOf, location.origin);
      pageRoute = matchRoute(url.pathname.slice(router.base.length) || '/');
      overlayId = loc.route.id;
    }
    return html`
      <a class="skip" href="#main" data-router="off" @click=${this.#skip}>${this.t('app.skipToContent')}</a>
      ${config.api.mock ? html`<div class="demo" role="note">${this.t('app.demo')}</div>` : nothing}
      <ep-header .route=${pageRoute} ?inert=${!!overlayId}></ep-header>
      <main id="main" tabindex="-1" ?inert=${!!overlayId}>${this.#page(pageRoute)}</main>
      <ep-footer ?inert=${!!overlayId}></ep-footer>
      ${overlayId ? html`<ep-asset-viewer mode="overlay" .assetId=${overlayId}></ep-asset-viewer>` : nothing}
      <ep-basket-drawer></ep-basket-drawer>
      <ep-toasts></ep-toasts>
    `;
  }

  #skip(event: Event) {
    event.preventDefault();
    this.renderRoot.querySelector<HTMLElement>('main')?.focus();
  }
}

customElements.define('ep-app', EpApp);
