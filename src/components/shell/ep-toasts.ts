import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';

/** Meldungsbereich (aria-live) unten in der Mitte. */
export class EpToasts extends EpElement {
  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        position: fixed;
        left: 50%;
        bottom: max(1.25rem, env(safe-area-inset-bottom));
        transform: translateX(-50%);
        z-index: 1200;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        pointer-events: none;
        width: min(32rem, calc(100vw - 2rem));
      }
      .toast {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 0.65rem;
        padding: 0.7rem 0.9rem 0.7rem 1.05rem;
        border-radius: 999px;
        background: var(--ep-text);
        color: var(--ep-bg);
        font-size: var(--ep-text-s);
        box-shadow: var(--ep-shadow-l);
        animation: in var(--ep-dur) var(--ep-ease);
      }
      .toast.danger {
        background: var(--wa-color-danger-fill-loud);
        color: var(--wa-color-danger-on-loud);
      }
      .toast wa-icon {
        font-size: 1rem;
        flex-shrink: 0;
      }
      button {
        border: 0;
        background: transparent;
        color: inherit;
        opacity: 0.65;
        cursor: pointer;
        padding: 0.15rem;
        display: grid;
        place-items: center;
        border-radius: 50%;
      }
      button:hover {
        opacity: 1;
      }
      @keyframes in {
        from {
          opacity: 0;
          transform: translateY(10px) scale(0.98);
        }
      }
    `,
  ];

  constructor() {
    super();
    new StoreController(this, this.services.toast);
  }

  override render() {
    const { toast } = this.services;
    return html`<div role="status" aria-live="polite" style="display:contents">
      ${repeat(
        toast.state.toasts,
        (t) => t.id,
        (t) =>
          html`<div class="toast ${t.variant}">
            ${t.icon ? html`<wa-icon name=${t.icon}></wa-icon>` : null}
            <span>${t.message}</span>
            <button type="button" aria-label=${this.t('common.close')} @click=${() => toast.dismiss(t.id)}>
              <wa-icon name="x"></wa-icon>
            </button>
          </div>`,
      )}
    </div>`;
  }
}

customElements.define('ep-toasts', EpToasts);
