import { html } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
export class EpMapPage extends EpElement {
  static override properties = {
    assetId: { attribute: false },
    collectionId: { attribute: false },
    mode: {},
  };
  override render() {
    return html`<p style="padding:2rem">ep-map-page</p>`;
  }
}
customElements.define('ep-map-page', EpMapPage);
