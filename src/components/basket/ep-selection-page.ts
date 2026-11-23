import { html } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
export class EpSelectionPage extends EpElement {
  static override properties = {
    assetId: { attribute: false },
    collectionId: { attribute: false },
    mode: {},
  };
  override render() {
    return html`<p style="padding:2rem">ep-selection-page</p>`;
  }
}
customElements.define('ep-selection-page', EpSelectionPage);
