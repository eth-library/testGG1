import { LitElement, css } from 'lit';
import { app } from '../app/services.ts';
import type { MessageKey } from '../i18n/de.ts';
import type { Params } from '../i18n/i18n.ts';
import type { LocalizedText } from '../config/schema.ts';
import { StoreController } from '../state/store.ts';

/** Gemeinsame Basis: Zugriff auf Dienste, Übersetzung und automatisches Neuzeichnen bei Sprachwechsel. */
export class EpElement extends LitElement {
  static baseStyles = css`
    :host {
      box-sizing: border-box;
    }
    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }
    [hidden] {
      display: none !important;
    }
    .visually-hidden {
      position: absolute !important;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    /* Sichtbar ausgeblendete, aber vorgelesene Labels von Web-Awesome-Formularelementen */
    .sr-label::part(form-control-label),
    .sr-label::part(label) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
    }
    a {
      color: inherit;
    }
    button {
      font: inherit;
      color: inherit;
    }
    :focus-visible {
      outline: 2px solid var(--ep-accent);
      outline-offset: 2px;
    }
  `;

  constructor() {
    super();
    new StoreController(this, app().i18n);
  }

  protected get services() {
    return app();
  }

  protected t(key: MessageKey, params?: Params): string {
    return app().i18n.t(key, params);
  }

  protected pick(text: LocalizedText | undefined, fallback = ''): string {
    return app().i18n.pick(text, fallback);
  }

  protected href(path: string, query?: URLSearchParams | Record<string, string>): string {
    return app().router.href(path, query);
  }

  protected emit<T>(name: string, detail?: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
}
