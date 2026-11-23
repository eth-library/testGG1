import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import type { FilterConfig } from '../../config/schema.ts';

/** Zeitraumfilter: Jahresregler (Jahrzehnte), Von/Bis-Felder und Jahrzehnt-Schnellwahl. */
export class EpDateFilter extends EpElement {
  static override properties = { filter: { attribute: false } };
  declare filter: FilterConfig;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
      }
      .inputs {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
        align-items: end;
        gap: 0.5rem;
        margin-top: 0.75rem;
      }
      .dash {
        padding-bottom: 0.55rem;
        color: var(--ep-muted);
      }
      .inputs wa-input {
        min-width: 0;
      }
      wa-slider {
        --track-size: 3px;
        --thumb-width: 16px;
        --thumb-height: 16px;
        margin: 0.25rem 0.35rem 0;
      }
      .decades {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
        margin-top: 0.75rem;
      }
      .decades button {
        border: 1px solid var(--ep-border);
        background: transparent;
        border-radius: 999px;
        padding: 0.18rem 0.5rem;
        font-size: 0.7rem;
        font-variant-numeric: tabular-nums;
        color: var(--ep-muted);
        cursor: pointer;
        transition: all var(--ep-dur-fast);
      }
      .decades button:hover {
        color: var(--ep-text);
        border-color: var(--ep-border-strong);
      }
      .decades button[aria-pressed='true'] {
        background: var(--ep-accent);
        border-color: var(--ep-accent);
        color: var(--ep-accent-on);
      }
      .reset {
        margin-top: 0.6rem;
        border: 0;
        background: none;
        padding: 0;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        color: var(--ep-accent-text);
        cursor: pointer;
      }
    `,
  ];

  constructor() {
    super();
    new StoreController(this, this.services.search);
  }

  get #source() {
    return this.filter.source ?? '';
  }

  get #bounds(): [number, number] {
    return this.filter.decades ?? [1850, new Date().getFullYear()];
  }

  #set(from?: string, to?: string) {
    const { search } = this.services;
    const dates = { ...search.state.query.dates };
    if (from || to) dates[this.#source] = { from: from || undefined, to: to || undefined };
    else delete dates[this.#source];
    search.update({ dates });
  }

  #onSlider(event: Event) {
    const slider = event.target as HTMLElement & { minValue: number; maxValue: number };
    const [min, max] = this.#bounds;
    const from = slider.minValue <= min ? undefined : `${slider.minValue}-01-01`;
    const to = slider.maxValue >= max ? undefined : `${slider.maxValue}-12-31`;
    this.#set(from, to);
  }

  #onYear(which: 'from' | 'to', value: string) {
    const range = this.services.search.state.query.dates[this.#source] ?? {};
    const year = value.trim();
    const iso = /^\d{4}$/.test(year)
      ? which === 'from'
        ? `${year}-01-01`
        : `${year}-12-31`
      : /^\d{4}-\d{2}-\d{2}$/.test(year)
        ? year
        : undefined;
    if (which === 'from') this.#set(iso, range.to);
    else this.#set(range.from, iso);
  }

  override render() {
    const [min, max] = this.#bounds;
    const range = this.services.search.state.query.dates[this.#source] ?? {};
    const fromYear = range.from ? Number(range.from.slice(0, 4)) : min;
    const toYear = range.to ? Number(range.to.slice(0, 4)) : max;
    const decades: number[] = [];
    for (let d = Math.floor(min / 10) * 10; d <= max; d += 10) decades.push(d);
    const isDecade = (d: number) => range.from === `${d}-01-01` && range.to === `${d + 9}-12-31`;
    return html`
      <wa-slider
        class="sr-label"
        range
        min=${min}
        max=${max}
        step="1"
        .minValue=${fromYear}
        .maxValue=${toYear}
        with-tooltip
        label=${this.t('filters.decade')}
        @change=${this.#onSlider}
      ></wa-slider>
      <div class="inputs">
        <wa-input
          size="s"
          label=${this.t('filters.dateFrom')}
          inputmode="numeric"
          placeholder=${String(min)}
          .value=${range.from ? range.from.slice(0, 4) : ''}
          @change=${(e: Event) => this.#onYear('from', (e.target as HTMLInputElement).value)}
        ></wa-input>
        <span class="dash">–</span>
        <wa-input
          size="s"
          label=${this.t('filters.dateTo')}
          inputmode="numeric"
          placeholder=${String(max)}
          .value=${range.to ? range.to.slice(0, 4) : ''}
          @change=${(e: Event) => this.#onYear('to', (e.target as HTMLInputElement).value)}
        ></wa-input>
      </div>
      <div class="decades" role="group" aria-label=${this.t('filters.decade')}>
        ${decades.map(
          (d) =>
            html`<button
              type="button"
              aria-pressed=${isDecade(d) ? 'true' : 'false'}
              @click=${() => (isDecade(d) ? this.#set() : this.#set(`${d}-01-01`, `${d + 9}-12-31`))}
            >
              ${this.t('filters.decadeLabel', { decade: String(d) })}
            </button>`,
        )}
      </div>
      ${
        range.from || range.to
          ? html`<button type="button" class="reset" @click=${() => this.#set()}>
              ${this.t('filters.reset')}
            </button>`
          : nothing
      }
    `;
  }
}

customElements.define('ep-date-filter', EpDateFilter);
