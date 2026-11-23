import { html } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
export class EpSearchPage extends EpElement {
  static override properties = {
    assetId: { attribute: false },
    collectionId: { attribute: false },
    mode: {},
  };
  override render() {
    return html`<p style="padding:2rem">ep-search-page</p>`;
  }
}
customElements.define('ep-search-page', EpSearchPage);
