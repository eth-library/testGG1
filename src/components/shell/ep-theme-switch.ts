import { css, html } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import type { ColorScheme } from '../../theme/theme-controller.ts';

const ICON: Record<ColorScheme, string> = { light: 'sun', dark: 'moon', system: 'monitor' };

/** Umschalter Hell / Dunkel / System. */
export class EpThemeSwitch extends EpElement {
  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: inline-block;
      }
      wa-icon {
        font-size: 1.1rem;
      }
    `,
  ];

  constructor() {
    super();
    new StoreController(this, this.services.theme);
  }

  override render() {
    const { theme } = this.services;
    const current = theme.scheme;
    const label = `${this.t('theme.label')}: ${this.t(`theme.${current}`)}`;
    return html`
      <wa-dropdown placement="bottom-end" @wa-select=${this.#select}>
        <wa-button slot="trigger" appearance="plain" size="s" aria-label=${label} title=${label}>
          <wa-icon
            name=${current === 'system' ? (theme.resolved === 'dark' ? 'moon' : 'sun') : ICON[current]}
          ></wa-icon>
        </wa-button>
        ${(['light', 'dark', 'system'] as const).map(
          (scheme) => html`
            <wa-dropdown-item type="checkbox" value=${scheme} ?checked=${scheme === current}>
              <wa-icon slot="icon" name=${ICON[scheme]}></wa-icon>
              ${this.t(`theme.${scheme}`)}
            </wa-dropdown-item>
          `,
        )}
      </wa-dropdown>
    `;
  }

  #select(event: CustomEvent<{ item: { value: ColorScheme } }>) {
    this.services.theme.setScheme(event.detail.item.value);
  }
}

customElements.define('ep-theme-switch', EpThemeSwitch);
