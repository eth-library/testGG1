import { html } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
export class EpAssetViewer extends EpElement {
  static override properties = {
    assetId: { attribute: false },
    collectionId: { attribute: false },
    mode: {},
  };
  override render() {
    return html`<p style="padding:2rem">ep-asset-viewer</p>`;
  }
}
customElements.define('ep-asset-viewer', EpAssetViewer);
