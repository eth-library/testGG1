import { html } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
export class EpHomePage extends EpElement {
  static override properties = {
    assetId: { attribute: false },
    collectionId: { attribute: false },
    mode: {},
  };
  override render() {
    return html`<p style="padding:2rem">ep-home-page</p>`;
  }
}
customElements.define('ep-home-page', EpHomePage);
