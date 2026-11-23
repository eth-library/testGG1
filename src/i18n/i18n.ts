import type { LocalizedText } from '../config/schema.ts';
import { storage } from '../state/store.ts';
import { de, type MessageKey } from './de.ts';
import { en } from './en.ts';

export type Messages = Record<MessageKey, string>;
export const LOCALE_STORAGE_KEY = 'ep-locale';

const BUILTIN: Record<string, Messages> = { de, en };

export type Params = Record<string, string | number>;

/** Ersetzt {platzhalter} und wählt bei `count` die Pluralform «null|eins|mehrere». */
export function format(template: string, params: Params = {}, locale = 'de'): string {
  let text = template;
  if (template.includes('|') && typeof params.count === 'number') {
    const forms = template.split('|');
    const n = params.count;
    text = forms.length === 3 ? forms[n === 0 ? 0 : n === 1 ? 1 : 2] : n === 1 ? forms[0] : forms[1];
  }
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    if (value === undefined) return match;
    return typeof value === 'number' ? value.toLocaleString(locale === 'de' ? 'de-CH' : locale) : value;
  });
}

export class I18n extends EventTarget {
  #locale: string;
  readonly #available: string[];
  readonly #fallback: string;

  constructor(available: string[], fallback: string) {
    super();
    this.#available = available;
    this.#fallback = fallback;
    this.#locale = this.#detect();
    document.documentElement.lang = this.#locale;
  }

  get locale(): string {
    return this.#locale;
  }

  get available(): string[] {
    return this.#available;
  }

  /** BCP-47-Tag für Intl-Formatierungen (Schweizer Varianten). */
  get intlLocale(): string {
    const variants: Record<string, string> = { de: 'de-CH', en: 'en-GB', fr: 'fr-CH', it: 'it-CH' };
    return variants[this.#locale] ?? this.#locale;
  }

  setLocale(locale: string): void {
    if (!this.#available.includes(locale) || locale === this.#locale) return;
    this.#locale = locale;
    storage.set(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    this.dispatchEvent(new Event('change'));
  }

  subscribe(listener: () => void): () => void {
    this.addEventListener('change', listener);
    return () => this.removeEventListener('change', listener);
  }

  t(key: MessageKey, params?: Params): string {
    const messages = BUILTIN[this.#locale] ?? BUILTIN[this.#fallback] ?? de;
    const template = messages[key] ?? de[key] ?? key;
    return format(template, params, this.#locale);
  }

  /** Wählt aus einem lokalisierten Config-Text die passende Sprache. */
  pick(text: LocalizedText | undefined, fallback = ''): string {
    if (text === undefined) return fallback;
    if (typeof text === 'string') return text;
    return text[this.#locale] ?? text[this.#fallback] ?? Object.values(text)[0] ?? fallback;
  }

  number(value: number): string {
    return value.toLocaleString(this.intlLocale);
  }

  #detect(): string {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl && this.#available.includes(fromUrl)) return fromUrl;
    const stored = storage.get<string | null>(LOCALE_STORAGE_KEY, null);
    if (stored && this.#available.includes(stored)) return stored;
    for (const lang of navigator.languages ?? []) {
      const short = lang.slice(0, 2).toLowerCase();
      if (this.#available.includes(short)) return short;
    }
    return this.#fallback;
  }
}
