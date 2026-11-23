import { html } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
export class EpBasketButton extends EpElement {
  static override properties = {
    assetId: { attribute: false },
    collectionId: { attribute: false },
    mode: {},
  };
  override render() {
    return html`<p style="padding:2rem">ep-basket-button</p>`;
  }
}
customElements.define('ep-basket-button', EpBasketButton);
