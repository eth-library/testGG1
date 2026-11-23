import type { AppConfig } from '../config/schema.ts';
import { storage } from '../state/store.ts';
import { deriveTokens, tokensToCss } from './theme-css.ts';

export type ColorScheme = 'light' | 'dark' | 'system';
export const SCHEME_STORAGE_KEY = 'ep-color-scheme';

/**
 * Setzt Farbschema (hell/dunkel/System) und das in der Config gewählte Farbtheme.
 * Das Inline-Script in index.html setzt die Klasse bereits vor dem ersten Paint; dieser Controller
 * übernimmt danach (Umschalter, Systemwechsel, Theme-Tokens).
 */
export class ThemeController extends EventTarget {
  #scheme: ColorScheme;
  #media = window.matchMedia('(prefers-color-scheme: dark)');
  #styleEl: HTMLStyleElement;

  constructor(private readonly config: AppConfig) {
    super();
    const stored = storage.get<string | null>(SCHEME_STORAGE_KEY, null);
    this.#scheme = stored === 'light' || stored === 'dark' ? stored : 'system';
    this.#styleEl = document.querySelector('style#ep-theme-tokens') ?? document.createElement('style');
    this.#styleEl.id = 'ep-theme-tokens';
    document.head.append(this.#styleEl);
    this.#media.addEventListener('change', () => {
      if (this.#scheme === 'system') this.#apply();
    });
    this.#writeTokens();
    this.#apply();
  }

  get scheme(): ColorScheme {
    return this.#scheme;
  }

  /** Tatsächlich aktives Schema (System aufgelöst). */
  get resolved(): 'light' | 'dark' {
    if (this.#scheme === 'system') return this.#media.matches ? 'dark' : 'light';
    return this.#scheme;
  }

  setScheme(scheme: ColorScheme): void {
    this.#scheme = scheme;
    if (scheme === 'system') storage.remove(SCHEME_STORAGE_KEY);
    else storage.set(SCHEME_STORAGE_KEY, scheme);
    this.#apply(true);
  }

  subscribe(listener: () => void): () => void {
    this.addEventListener('change', listener);
    return () => this.removeEventListener('change', listener);
  }

  #writeTokens(): void {
    const { theme } = this.config;
    const def = theme.themes[theme.active];
    const fonts = `
:root {
  --ep-font-display: '${theme.fonts.display}', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif;
  --ep-font-ui: '${theme.fonts.ui}', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --wa-font-family-body: var(--ep-font-ui);
  --wa-font-family-heading: var(--ep-font-ui);
  --wa-font-family-longform: var(--ep-font-ui);
  --wa-border-radius-scale: ${theme.radiusScale};
}`;
    this.#styleEl.textContent = [
      tokensToCss(':root.wa-light', deriveTokens(def.light, 'light')),
      tokensToCss(':root.wa-dark', deriveTokens(def.dark, 'dark')),
      fonts,
    ].join('\n');
    document.documentElement.dataset.theme = theme.active;
  }

  #apply(animate = false): void {
    const root = document.documentElement;
    const resolved = this.resolved;
    const swap = () => {
      root.classList.toggle('wa-dark', resolved === 'dark');
      root.classList.toggle('wa-light', resolved === 'light');
      root.dataset.scheme = this.#scheme;
      this.dispatchEvent(new Event('change'));
    };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (animate && !reduced && 'startViewTransition' in document) {
      root.classList.add('ep-scheme-transition');
      const transition = document.startViewTransition(swap);
      transition.finished.finally(() => root.classList.remove('ep-scheme-transition'));
    } else {
      swap();
    }
  }
}
