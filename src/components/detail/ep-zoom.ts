import { css, html } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';

type Viewer = {
  destroy(): void;
  viewport: { zoomBy(f: number): void; goHome(): void; applyConstraints(): void };
  addHandler(name: string, fn: () => void): void;
};

/**
 * Deep Zoom mit OpenSeadragon (bei Bedarf nachgeladen). Unterstützt einfache Bilder;
 * IIIF-Kachelquellen können später über `source` direkt übergeben werden.
 */
export class EpZoom extends EpElement {
  static override properties = { src: {}, ready: { state: true } };
  declare src: string;
  declare ready: boolean;
  #viewer?: Viewer;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
      }
      .osd {
        position: absolute;
        inset: 0;
      }
      .controls {
        position: absolute;
        left: 50%;
        bottom: 1.25rem;
        transform: translateX(-50%);
        display: flex;
        gap: 0.25rem;
        padding: 0.3rem;
        border-radius: 999px;
        background: rgb(20 20 22 / 0.72);
        backdrop-filter: blur(10px);
        z-index: 2;
      }
      .controls button {
        display: grid;
        place-items: center;
        width: 2.4rem;
        height: 2.4rem;
        border: 0;
        border-radius: 50%;
        background: none;
        color: #fff;
        cursor: pointer;
      }
      .controls button:hover {
        background: rgb(255 255 255 / 0.14);
      }
      .loading {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        color: #fff;
        font-size: 2rem;
      }
    `,
  ];

  constructor() {
    super();
    this.ready = false;
  }

  override async firstUpdated() {
    const { default: OpenSeadragon } = await import('openseadragon');
    const element = this.renderRoot.querySelector<HTMLElement>('.osd')!;
    const viewer = OpenSeadragon({
      element,
      tileSources: { type: 'image', url: this.src, buildPyramid: false } as unknown as string,
      drawer: 'canvas',
      crossOriginPolicy: false,
      showNavigationControl: false,
      showNavigator: true,
      navigatorPosition: 'TOP_RIGHT',
      navigatorAutoFade: true,
      visibilityRatio: 0.9,
      minZoomImageRatio: 0.8,
      maxZoomPixelRatio: 3,
      animationTime: 0.6,
      blendTime: 0.2,
      gestureSettingsMouse: { clickToZoom: true, dblClickToZoom: true },
    }) as unknown as Viewer;
    viewer.addHandler('open', () => (this.ready = true));
    this.#viewer = viewer;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#viewer?.destroy();
    this.#viewer = undefined;
  }

  zoom(factor: number) {
    this.#viewer?.viewport.zoomBy(factor);
    this.#viewer?.viewport.applyConstraints();
  }

  reset() {
    this.#viewer?.viewport.goHome();
  }

  override render() {
    return html`
      <div class="osd" role="img" aria-label=${this.t('detail.zoom')}></div>
      ${this.ready ? '' : html`<div class="loading"><wa-spinner></wa-spinner></div>`}
      <div class="controls">
        <button type="button" aria-label=${this.t('detail.zoomOut')} @click=${() => this.zoom(1 / 1.6)}>
          <wa-icon name="zoom-out"></wa-icon>
        </button>
        <button type="button" aria-label=${this.t('detail.zoomReset')} @click=${() => this.reset()}>
          <wa-icon name="locate"></wa-icon>
        </button>
        <button type="button" aria-label=${this.t('detail.zoomIn')} @click=${() => this.zoom(1.6)}>
          <wa-icon name="zoom-in"></wa-icon>
        </button>
      </div>
    `;
  }
}

customElements.define('ep-zoom', EpZoom);
