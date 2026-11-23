import { html } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
export class EpBasketDrawer extends EpElement {
  static override properties = {
    assetId: { attribute: false },
    collectionId: { attribute: false },
    mode: {},
  };
  override render() {
    return html`<p style="padding:2rem">ep-basket-drawer</p>`;
  }
}
customElements.define('ep-basket-drawer', EpBasketDrawer);
