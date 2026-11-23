import type { AppConfig } from '../config/schema.ts';

type Command = [string, ...unknown[]];
declare global {
  interface Window {
    _paq?: Command[];
  }
}

/**
 * Matomo-Anbindung gemäss «Spec_anura-matomo» (ETH-Bibliothek): Visits, Pageviews bei
 * SPA-Navigation (entprellt), Site Search, Outlinks und Downloads. Standardmässig aus.
 */
export class Analytics {
  readonly enabled: boolean;
  #lastUrl = '';
  #timer?: number;

  constructor(config: AppConfig['analytics']['matomo']) {
    this.enabled = config.enabled && !!config.url && !!config.siteId;
    if (!this.enabled) return;
    const base = config.url.endsWith('/') ? config.url : `${config.url}/`;
    const paq = (window._paq = window._paq ?? []);
    paq.push(['setTrackerUrl', `${base}matomo.php`]);
    paq.push(['setSiteId', config.siteId]);
    paq.push(['enableLinkTracking']);
    const script = document.createElement('script');
    script.async = true;
    script.src = `${base}matomo.js`;
    document.head.append(script);
    // Outlinks aus Shadow-DOMs erkennt Matomo nicht selbst.
    document.addEventListener(
      'click',
      (event) => {
        const anchor = event
          .composedPath()
          .find((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement && !!el.href);
        if (!anchor || anchor.hasAttribute('download')) return;
        const url = new URL(anchor.href);
        if (url.origin !== location.origin && /^https?:$/.test(url.protocol))
          this.#push(['trackLink', url.href, 'link']);
      },
      { capture: true },
    );
  }

  #push(command: Command): void {
    if (this.enabled) window._paq?.push(command);
  }

  /** Pageview nach Routenwechsel; mehrfache Aufrufe innerhalb von 300 ms werden zusammengefasst. */
  pageView(title = document.title): void {
    if (!this.enabled) return;
    window.clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => {
      const url = location.href;
      if (url === this.#lastUrl) return;
      if (this.#lastUrl) this.#push(['setReferrerUrl', this.#lastUrl]);
      this.#lastUrl = url;
      this.#push(['setCustomUrl', url]);
      this.#push(['setDocumentTitle', title]);
      this.#push(['trackPageView']);
    }, 300);
  }

  siteSearch(keyword: string, category: string | false, resultCount: number): void {
    if (keyword.trim()) this.#push(['trackSiteSearch', keyword.trim(), category, resultCount]);
  }

  /** Download-Tracking; `format` z. B. Original, Screen (Web), Thumbnail. */
  download(url: string, format: string, assetId: string): void {
    this.#push(['trackLink', url, 'download']);
    this.#push(['trackEvent', 'Download', format, assetId]);
  }

  event(category: string, action: string, name?: string, value?: number): void {
    this.#push(['trackEvent', category, action, name, value].filter((x) => x !== undefined) as Command);
  }
}
