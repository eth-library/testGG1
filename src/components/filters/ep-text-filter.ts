import { css, html } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController } from '../../state/store.ts';
import type { FilterConfig } from '../../config/schema.ts';
import type { MessageKey } from '../../i18n/de.ts';

const OPERATIONS = ['Contains', 'DoesNotContain', 'Equals', 'NotEquals', 'FuzzyContains', 'FuzzyEquals'];

/** Freitextfilter auf ein Feld mit wählbarer Bedingung. */
export class EpTextFilter extends EpElement {
  static override properties = { filter: { attribute: false } };
  declare filter: FilterConfig;

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: grid;
        gap: 0.5rem;
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

  /** Gewählte Bedingung, solange noch kein Text eingegeben ist. */
  #draftOp?: string;

  #apply(patch: { op?: string; value?: string }) {
    const { search } = this.services;
    const current = search.state.query.texts[this.#source] ?? {
      op: this.#draftOp ?? this.filter.operation ?? 'Contains',
      value: '',
    };
    const next = { ...current, ...patch };
    this.#draftOp = next.op;
    const texts = { ...search.state.query.texts };
    if (next.value.trim()) texts[this.#source] = next;
    else delete texts[this.#source];
    search.update({ texts });
  }

  override render() {
    const current = this.services.search.state.query.texts[this.#source];
    const op = current?.op ?? this.#draftOp ?? this.filter.operation ?? 'Contains';
    return html`
      <wa-select
        class="sr-label"
        size="s"
        .value=${op}
        label=${this.t('filters.operation')}
        @change=${(e: Event) => this.#apply({ op: (e.target as HTMLSelectElement).value })}
      >
        ${OPERATIONS.map(
          (o) => html`<wa-option value=${o}>${this.t(`filters.op.${o}` as MessageKey)}</wa-option>`,
        )}
      </wa-select>
      <wa-input
        class="sr-label"
        size="s"
        type="search"
        label=${this.t('filters.textPlaceholder')}
        placeholder=${this.t('filters.textPlaceholder')}
        .value=${current?.value ?? ''}
        with-clear
        @change=${(e: Event) => this.#apply({ value: (e.target as HTMLInputElement).value })}
        @wa-clear=${() => this.#apply({ value: '' })}
      ></wa-input>
    `;
  }
}

customElements.define('ep-text-filter', EpTextFilter);
