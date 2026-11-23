import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';

export class EpFooter extends EpElement {
  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
        margin-top: clamp(4rem, 10vw, 8rem);
        border-top: 1px solid var(--ep-border);
      }
      footer {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        gap: 2rem 4rem;
        max-width: var(--ep-max);
        margin: 0 auto;
        padding: clamp(2.5rem, 6vw, 4.5rem) var(--ep-gutter) 2.5rem;
      }
      .claim {
        font-family: var(--ep-font-display);
        font-size: var(--ep-display-s);
        line-height: 1.1;
        letter-spacing: -0.01em;
        margin: 0 0 1rem;
        max-width: 22ch;
      }
      .claim em {
        color: var(--ep-muted);
      }
      p {
        margin: 0;
        color: var(--ep-muted);
        max-width: 52ch;
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
        gap: 0.4rem 1.5rem;
        align-content: start;
      }
      a {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: var(--ep-text);
        text-decoration: none;
        font-size: var(--ep-text-s);
        padding: 0.25rem 0;
        background: linear-gradient(currentColor, currentColor) 0 100% / 0 1px no-repeat;
        transition: background-size var(--ep-dur) var(--ep-ease);
      }
      a:hover {
        background-size: 100% 1px;
      }
      a wa-icon {
        font-size: 0.8rem;
        color: var(--ep-muted);
      }
      .bottom {
        grid-column: 1 / -1;
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 1rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--ep-border);
        font-size: var(--ep-text-xs);
        color: var(--ep-muted);
      }
      @media (max-width: 760px) {
        footer {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  override render() {
    const { config } = this.services;
    const name = this.pick(config.branding.name);
    const owner = this.pick(config.branding.owner);
    return html`<footer>
      <div>
        <p class="claim">${name}${owner ? html` <em>· ${owner}</em>` : nothing}</p>
        ${config.branding.footerText ? html`<p>${this.pick(config.branding.footerText)}</p>` : nothing}
      </div>
      <ul>
        ${config.branding.links.map((link) => {
          const external = /^https?:/.test(link.href);
          return html`<li>
            <a href=${link.href} target=${external ? '_blank' : '_self'} rel=${external ? 'noopener' : ''}>
              ${this.pick(link.label)} ${external ? html`<wa-icon name="arrow-up-right"></wa-icon>` : nothing}
            </a>
          </li>`;
        })}
      </ul>
      <div class="bottom">
        <span>© ${new Date().getFullYear()} ${owner || name}</span>
        <span>${this.pick(config.catalog.title)}</span>
      </div>
    </footer>`;
  }
}

customElements.define('ep-footer', EpFooter);
