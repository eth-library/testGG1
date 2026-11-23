import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import type { Route } from '../../router/router.ts';
import './ep-theme-switch.ts';
import './ep-lang-switch.ts';
import '../basket/ep-basket-button.ts';
import '../search/ep-search-bar.ts';

export class EpHeader extends EpElement {
  static override properties = {
    route: { attribute: false },
    scrolled: { state: true },
    pastHero: { state: true },
  };

  declare route: Route;
  declare scrolled: boolean;
  declare pastHero: boolean;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        position: sticky;
        top: 0;
        z-index: 60;
        display: block;
      }
      header {
        background: var(--ep-glass);
        backdrop-filter: blur(18px) saturate(1.5);
        -webkit-backdrop-filter: blur(18px) saturate(1.5);
        border-bottom: 1px solid transparent;
        transition:
          border-color var(--ep-dur) var(--ep-ease),
          box-shadow var(--ep-dur) var(--ep-ease);
      }
      header.scrolled {
        border-bottom-color: var(--ep-border);
      }
      .inner {
        display: flex;
        align-items: center;
        gap: clamp(0.75rem, 2vw, 2rem);
        max-width: var(--ep-max);
        height: var(--ep-header-h);
        margin: 0 auto;
        padding: 0 var(--ep-gutter);
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.7rem;
        text-decoration: none;
        color: var(--ep-text);
        flex-shrink: 0;
        border-radius: var(--ep-radius-s);
      }
      .mark {
        display: grid;
        place-items: center;
        width: 2.1rem;
        height: 2.1rem;
        border-radius: 0.55rem;
        background: var(--ep-text);
        color: var(--ep-bg);
        transition: transform var(--ep-dur) var(--ep-ease);
      }
      .brand:hover .mark {
        transform: rotate(-6deg) scale(1.04);
      }
      .mark svg {
        width: 1.3rem;
        height: 1.3rem;
      }
      .mark img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .wordmark {
        display: flex;
        flex-direction: column;
        line-height: 1;
      }
      .owner {
        font-size: 0.66rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ep-muted);
        margin-bottom: 0.22rem;
      }
      .name {
        font-family: var(--ep-font-display);
        font-size: 1.45rem;
        letter-spacing: -0.01em;
      }
      .search {
        flex: 1;
        max-width: 36rem;
        min-width: 0;
        transition:
          opacity var(--ep-dur) var(--ep-ease),
          transform var(--ep-dur) var(--ep-ease);
      }
      .search.concealed {
        opacity: 0;
        transform: translateY(-6px);
        pointer-events: none;
        visibility: hidden;
      }
      .spacer {
        flex: 1;
      }
      nav {
        display: flex;
        align-items: center;
        gap: 0.25rem;
      }
      nav a {
        position: relative;
        padding: 0.5rem 0.75rem;
        border-radius: 999px;
        font-size: var(--ep-text-s);
        font-weight: 500;
        letter-spacing: 0.01em;
        text-decoration: none;
        color: var(--ep-muted);
        transition:
          color var(--ep-dur-fast),
          background var(--ep-dur-fast);
      }
      nav a:hover {
        color: var(--ep-text);
        background: var(--ep-hover);
      }
      nav a[aria-current='page'] {
        color: var(--ep-text);
      }
      nav a[aria-current='page']::after {
        content: '';
        position: absolute;
        left: 0.75rem;
        right: 0.75rem;
        bottom: 0.28rem;
        height: 1.5px;
        border-radius: 1px;
        background: var(--ep-accent);
      }
      .tools {
        display: flex;
        align-items: center;
        gap: 0.15rem;
      }
      .menu {
        display: none;
      }
      @media (max-width: 980px) {
        nav {
          display: none;
        }
        .menu {
          display: inline-block;
        }
      }
      @media (max-width: 720px) {
        .owner {
          display: none;
        }
        .search:not(.concealed) {
          position: absolute;
          left: 0;
          right: 0;
          top: var(--ep-header-h);
          max-width: none;
          padding: 0 var(--ep-gutter) 0.75rem;
          background: var(--ep-glass);
          backdrop-filter: blur(18px) saturate(1.5);
          -webkit-backdrop-filter: blur(18px) saturate(1.5);
          border-bottom: 1px solid var(--ep-border);
        }
        .tools ep-lang-switch {
          display: none;
        }
      }
    `,
  ];

  #onScroll = () => {
    const y = window.scrollY;
    const scrolled = y > 4;
    const pastHero = y > Math.min(520, window.innerHeight * 0.55);
    if (scrolled !== this.scrolled) this.scrolled = scrolled;
    if (pastHero !== this.pastHero) this.pastHero = pastHero;
  };

  constructor() {
    super();
    this.scrolled = false;
    this.pastHero = false;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('scroll', this.#onScroll, { passive: true });
    this.#onScroll();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('scroll', this.#onScroll);
  }

  #current(name: string) {
    const route = this.route?.name;
    if (name === 'collections') return route === 'collections' || route === 'collection' ? 'page' : nothing;
    return route === name ? 'page' : nothing;
  }

  override render() {
    const { config } = this.services;
    const isHome = this.route?.name === 'home';
    const showSearch = !isHome || this.pastHero;
    const mapEnabled = config.map.enabled && !!config.fields.coordinates;
    return html`
      <header class=${this.scrolled ? 'scrolled' : ''}>
        <div class="inner">
          <a class="brand" href=${this.href('/')}>
            <span class="mark" aria-hidden="true">
              ${
                config.branding.logo
                  ? html`<img src=${config.branding.logo} alt="" />`
                  : html`<svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M3 18.5 9.2 9.6l4.3 5.8 2.9-3.8 4.6 6.9Z" />
                      <circle cx="16.8" cy="6.6" r="2.1" />
                    </svg>`
              }
            </span>
            <span class="wordmark">
              ${config.branding.owner ? html`<span class="owner">${this.pick(config.branding.owner)}</span>` : nothing}
              <span class="name">${this.pick(config.branding.name)}</span>
            </span>
          </a>
          <div class="search ${showSearch ? '' : 'concealed'}" ?inert=${!showSearch}>
            <ep-search-bar compact></ep-search-bar>
          </div>
          ${showSearch ? nothing : html`<span class="spacer"></span>`}
          <nav aria-label=${this.t('nav.main')}>
            <a href=${this.href('/suche')} aria-current=${this.#current('search')}>${this.t('nav.search')}</a>
            <a href=${this.href('/sammlungen')} aria-current=${this.#current('collections')}
              >${this.t('nav.collections')}</a
            >
            ${mapEnabled ? html`<a href=${this.href('/karte')} aria-current=${this.#current('map')}>${this.t('nav.map')}</a>` : nothing}
          </nav>
          <div class="tools">
            <ep-lang-switch></ep-lang-switch>
            <ep-theme-switch></ep-theme-switch>
            ${config.basket.enabled ? html`<ep-basket-button></ep-basket-button>` : nothing}
            <wa-dropdown class="menu" placement="bottom-end" @wa-select=${this.#onMenu}>
              <wa-button slot="trigger" appearance="plain" size="s" aria-label=${this.t('nav.main')}>
                <wa-icon name="menu" label=${this.t('nav.main')}></wa-icon>
              </wa-button>
              <wa-dropdown-item value="/suche"
                ><wa-icon slot="icon" name="search"></wa-icon>${this.t('nav.search')}</wa-dropdown-item
              >
              <wa-dropdown-item value="/sammlungen"
                ><wa-icon slot="icon" name="library"></wa-icon>${this.t('nav.collections')}</wa-dropdown-item
              >
              ${
                mapEnabled
                  ? html`<wa-dropdown-item value="/karte"
                      ><wa-icon slot="icon" name="map"></wa-icon>${this.t('nav.map')}</wa-dropdown-item
                    >`
                  : nothing
              }
              ${
                this.services.i18n.available.length > 1
                  ? html`<wa-divider></wa-divider> ${this.services.i18n.available.map(
                        (lang) =>
                          html`<wa-dropdown-item
                            value="lang:${lang}"
                            type="checkbox"
                            ?checked=${lang === this.services.i18n.locale}
                            >${lang.toUpperCase()}</wa-dropdown-item
                          >`,
                      )}`
                  : nothing
              }
            </wa-dropdown>
          </div>
        </div>
      </header>
    `;
  }

  #onMenu(event: CustomEvent<{ item: HTMLElement & { value: string } }>) {
    const value = event.detail.item.value;
    if (value.startsWith('lang:')) this.services.i18n.setLocale(value.slice(5));
    else this.services.router.navigate(this.href(value));
  }
}

customElements.define('ep-header', EpHeader);
