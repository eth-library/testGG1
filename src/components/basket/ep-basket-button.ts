import { css, html, nothing, type PropertyValues } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';

/** Kopfzeilen-Schaltfläche für die Auswahl mit Zähler (kurze Animation beim Hinzufügen). */
export class EpBasketButton extends EpElement {
  static override properties = { bump: { state: true } };
  declare bump: boolean;
  #last = -1;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: inline-block;
        position: relative;
      }
      .count {
        position: absolute;
        top: 0.05rem;
        right: 0.05rem;
        min-width: 1.05rem;
        height: 1.05rem;
        padding: 0 0.28rem;
        border-radius: 999px;
        background: var(--ep-accent);
        color: var(--ep-accent-on);
        font-size: 0.62rem;
        font-weight: 700;
        display: grid;
        place-items: center;
        pointer-events: none;
        font-variant-numeric: tabular-nums;
      }
      .count.bump {
        animation: bump 420ms var(--ep-ease);
      }
      @keyframes bump {
        40% {
          transform: scale(1.45);
        }
      }
      wa-icon {
        font-size: 1.15rem;
      }
    `,
  ];

  constructor() {
    super();
    this.bump = false;
    new StoreController(this, this.services.basket);
  }

  protected override willUpdate(_changed: PropertyValues): void {
    const count = this.services.basket.count;
    if (this.#last >= 0 && count > this.#last) {
      this.bump = false;
      requestAnimationFrame(() => (this.bump = true));
    }
    this.#last = count;
  }

  override render() {
    const { basket } = this.services;
    const count = basket.count;
    const label = `${this.t('basket.open')} (${this.t('basket.count', { count })})`;
    return html`
      <wa-button
        appearance="plain"
        size="s"
        aria-label=${label}
        title=${label}
        @click=${() => basket.setOpen(true)}
      >
        <wa-icon name="bookmark"></wa-icon>
      </wa-button>
      ${count ? html`<span class="count ${this.bump ? 'bump' : ''}" aria-hidden="true">${count}</span>` : nothing}
    `;
  }
}

customElements.define('ep-basket-button', EpBasketButton);
