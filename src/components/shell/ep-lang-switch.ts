import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';

/** Sprachwahl als kompakte Segmentschaltfläche (DE | EN). */
export class EpLangSwitch extends EpElement {
  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: inline-flex;
      }
      .group {
        display: inline-flex;
        padding: 0.18rem;
        border-radius: 999px;
        background: var(--ep-lowered);
      }
      button {
        border: 0;
        background: transparent;
        padding: 0.28rem 0.55rem;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        color: var(--ep-muted);
        cursor: pointer;
        transition:
          background var(--ep-dur-fast),
          color var(--ep-dur-fast);
      }
      button:hover {
        color: var(--ep-text);
      }
      button[aria-pressed='true'] {
        background: var(--ep-surface);
        color: var(--ep-text);
        box-shadow: var(--ep-shadow-s);
      }
    `,
  ];

  override render() {
    const { i18n } = this.services;
    if (i18n.available.length < 2) return nothing;
    return html`<div class="group" role="group" aria-label=${this.t('lang.label')}>
      ${i18n.available.map(
        (lang) =>
          html`<button
            type="button"
            lang=${lang}
            aria-pressed=${lang === i18n.locale ? 'true' : 'false'}
            @click=${() => i18n.setLocale(lang)}
          >
            ${lang.toUpperCase()}
          </button>`,
      )}
    </div>`;
  }
}

customElements.define('ep-lang-switch', EpLangSwitch);
