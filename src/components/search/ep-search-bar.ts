import { css, html, nothing } from 'lit';
import { EpElement } from '../../ui/ep-element.ts';
import { StoreController, storage } from '../../state/store.ts';
import { stateToParams, type SearchMode } from '../../state/search-state.ts';

const HISTORY_KEY = 'ep-search-history';

/**
 * Suchfeld mit Vorschlägen, Verlauf, UND/ODER-Verknüpfung und optionaler KI-Suche.
 * ARIA-Combobox-Muster; Varianten: `hero` (Startseite) und `compact` (Kopfzeile).
 */
export class EpSearchBar extends EpElement {
  static override properties = {
    compact: { type: Boolean, reflect: true },
    hero: { type: Boolean, reflect: true },
    value: { state: true },
    mode: { state: true },
    ai: { state: true },
    aiAvailable: { state: true },
    open: { state: true },
    suggestions: { state: true },
    active: { state: true },
  };

  declare compact: boolean;
  declare hero: boolean;
  declare value: string;
  declare mode: SearchMode;
  declare ai: boolean;
  declare aiAvailable: boolean;
  declare open: boolean;
  declare suggestions: string[];
  declare active: number;

  #timer?: number;
  #abort?: AbortController;
  #focused = false;
  #syncedKey = '';

  static override styles = [
    EpElement.baseStyles,
    css`
      :host {
        display: block;
        position: relative;
        --h: 2.6rem;
        --fs: var(--ep-text-m);
      }
      :host([hero]) {
        --h: clamp(3.6rem, 6vw, 4.4rem);
        --fs: clamp(1.05rem, 1.6vw, 1.25rem);
      }
      form {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        height: var(--h);
        padding: 0 0.4rem 0 1rem;
        border-radius: 999px;
        background: var(--ep-surface);
        border: 1px solid var(--ep-border);
        box-shadow: 0 1px 0 var(--ep-shadow-color);
        transition:
          border-color var(--ep-dur-fast),
          box-shadow var(--ep-dur) var(--ep-ease);
      }
      :host([compact]) form {
        background: var(--ep-lowered);
        border-color: transparent;
        box-shadow: none;
      }
      :host([hero]) form {
        padding-left: 1.5rem;
        box-shadow: var(--ep-shadow-l);
        border-color: transparent;
      }
      form:focus-within {
        border-color: var(--ep-border-strong);
        box-shadow:
          0 0 0 4px var(--ep-accent-soft),
          var(--ep-shadow-m);
        background: var(--ep-surface);
      }
      .icon {
        color: var(--ep-muted);
        font-size: 1.1em;
        flex-shrink: 0;
      }
      :host([hero]) .icon {
        font-size: 1.35rem;
      }
      input {
        flex: 1;
        min-width: 0;
        height: 100%;
        border: 0;
        outline: none;
        background: transparent;
        color: var(--ep-text);
        font: inherit;
        font-size: var(--fs);
        letter-spacing: -0.005em;
      }
      input::placeholder {
        color: var(--ep-muted);
        opacity: 0.85;
      }
      input::-webkit-search-cancel-button {
        display: none;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        height: 1.75rem;
        padding: 0 0.65rem;
        border-radius: 999px;
        border: 1px solid var(--ep-border);
        background: transparent;
        font-size: var(--ep-text-xs);
        font-weight: 600;
        letter-spacing: 0.04em;
        color: var(--ep-muted);
        cursor: pointer;
        white-space: nowrap;
        transition: all var(--ep-dur-fast);
      }
      .chip:hover {
        color: var(--ep-text);
        border-color: var(--ep-border-strong);
      }
      .chip[aria-pressed='true'] {
        color: var(--ep-accent-on);
        background: var(--ep-accent);
        border-color: var(--ep-accent);
      }
      .chip wa-icon {
        font-size: 0.85rem;
      }
      .round {
        display: grid;
        place-items: center;
        width: calc(var(--h) - 0.6rem);
        height: calc(var(--h) - 0.6rem);
        flex-shrink: 0;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--ep-muted);
        cursor: pointer;
        transition: background var(--ep-dur-fast);
      }
      .round:hover {
        background: var(--ep-hover);
        color: var(--ep-text);
      }
      .submit {
        background: var(--ep-accent);
        color: var(--ep-accent-on);
      }
      .submit:hover {
        background: var(--ep-accent);
        color: var(--ep-accent-on);
        filter: brightness(1.08);
      }
      :host([compact]) .submit {
        display: none;
      }
      .panel {
        position: absolute;
        top: calc(100% + 0.5rem);
        left: 0;
        right: 0;
        z-index: 30;
        padding: 0.5rem;
        border-radius: var(--ep-radius-l);
        background: var(--ep-raised);
        border: 1px solid var(--ep-border);
        box-shadow: var(--ep-shadow-l);
        animation: drop var(--ep-dur) var(--ep-ease);
      }
      @keyframes drop {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
      }
      .section {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0.75rem 0.3rem;
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: var(--ep-muted);
      }
      .section button {
        border: 0;
        background: none;
        color: var(--ep-muted);
        font-size: var(--ep-text-xs);
        letter-spacing: 0;
        text-transform: none;
        cursor: pointer;
        text-decoration: underline;
      }
      [role='option'] {
        display: flex;
        align-items: center;
        gap: 0.7rem;
        padding: 0.55rem 0.75rem;
        border-radius: var(--ep-radius-m);
        cursor: pointer;
        font-size: var(--ep-text-m);
      }
      [role='option'] wa-icon {
        color: var(--ep-muted);
        flex-shrink: 0;
      }
      [role='option'][aria-selected='true'] {
        background: var(--ep-hover);
      }
      mark {
        background: none;
        color: inherit;
        font-weight: 650;
      }
      .hint {
        padding: 0.6rem 0.75rem 0.35rem;
        font-size: var(--ep-text-xs);
        color: var(--ep-muted);
        border-top: 1px solid var(--ep-border);
        margin-top: 0.35rem;
      }
      @media (max-width: 560px) {
        .chip span {
          display: none;
        }
      }
    `,
  ];

  constructor() {
    super();
    this.compact = false;
    this.hero = false;
    this.value = '';
    this.mode = 'or';
    this.ai = false;
    this.aiAvailable = false;
    this.open = false;
    this.suggestions = [];
    this.active = -1;
    new StoreController(this, this.services.search);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.services.catalog.isAiSearchEnabled().then((enabled) => (this.aiAvailable = enabled));
  }

  protected override willUpdate(): void {
    // Wert aus dem Suchzustand übernehmen, solange nicht getippt wird.
    const { query, results } = this.services.search.state;
    if (!this.#focused && results.key !== this.#syncedKey) {
      this.#syncedKey = results.key;
      this.value = query.q;
      this.mode = query.mode;
      this.ai = query.ai;
    }
  }

  get #history(): string[] {
    return storage.get<string[]>(HISTORY_KEY, []);
  }

  #remember(q: string) {
    const size = this.services.config.search.historySize;
    if (!q || size === 0) return;
    storage.set(HISTORY_KEY, [q, ...this.#history.filter((h) => h !== q)].slice(0, size));
  }

  get #items(): Array<{ text: string; kind: 'suggestion' | 'history' }> {
    const v = this.value.trim().toLowerCase();
    const history = this.#history
      .filter((h) => !v || (h.toLowerCase().includes(v) && h.toLowerCase() !== v))
      .slice(0, v ? 3 : 6)
      .map((text) => ({ text, kind: 'history' as const }));
    const suggestions = this.suggestions
      .filter((s) => s.toLowerCase() !== v && !history.some((h) => h.text === s))
      .map((text) => ({ text, kind: 'suggestion' as const }));
    return [...history, ...suggestions];
  }

  #onInput(event: InputEvent) {
    this.value = (event.target as HTMLInputElement).value;
    this.active = -1;
    this.open = true;
    window.clearTimeout(this.#timer);
    this.#timer = window.setTimeout(() => this.#loadSuggestions(), 180);
  }

  async #loadSuggestions() {
    this.#abort?.abort();
    const text = this.value.trim();
    if (text.length < 2) {
      this.suggestions = [];
      return;
    }
    const controller = new AbortController();
    this.#abort = controller;
    try {
      const list = await this.services.catalog.suggest(
        text,
        this.services.search.state.query,
        controller.signal,
      );
      if (!controller.signal.aborted) this.suggestions = list.slice(0, 7);
    } catch {
      /* Vorschläge sind optional */
    }
  }

  #onKeydown(event: KeyboardEvent) {
    const items = this.#items;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.open = true;
      this.active = Math.min(items.length - 1, this.active + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.active = Math.max(-1, this.active - 1);
    } else if (event.key === 'Escape') {
      if (this.open) this.open = false;
      else this.value = '';
    } else if (event.key === 'Enter' && this.open && this.active >= 0 && items[this.active]) {
      event.preventDefault();
      this.#submit(items[this.active].text);
    }
  }

  #submit(text = this.value) {
    const q = text.trim();
    this.value = q;
    this.open = false;
    this.#remember(q);
    const { search, router } = this.services;
    const patch = { q, mode: this.mode, ai: this.ai };
    if (search.state.scope !== 'none' && router.location.route.name !== 'asset') {
      search.update(patch);
    } else {
      const params = stateToParams({
        ...search.state.query,
        ...patch,
        facets: {},
        dates: {},
        texts: {},
        category: undefined,
        geo: undefined,
      });
      router.navigate(this.href('/suche', params));
    }
    this.renderRoot.querySelector('input')?.blur();
  }

  #clear() {
    this.value = '';
    this.suggestions = [];
    this.renderRoot.querySelector('input')?.focus();
    if (this.services.search.state.query.q) this.services.search.update({ q: '' });
  }

  #highlight(text: string) {
    const v = this.value.trim();
    const index = v ? text.toLowerCase().indexOf(v.toLowerCase()) : -1;
    if (index < 0) return text;
    return html`${text.slice(0, index)}<mark>${text.slice(index, index + v.length)}</mark>${text.slice(index + v.length)}`;
  }

  override render() {
    const items = this.open ? this.#items : [];
    const multiWord = this.value.trim().split(/\s+/).length > 1 && !/^".*"$/.test(this.value.trim());
    const history = items.filter((i) => i.kind === 'history');
    const suggestions = items.filter((i) => i.kind === 'suggestion');
    const total = this.services.config.home.stats[0]?.value;
    const placeholder =
      this.hero && total ? this.t('search.placeholder', { count: total }) : this.t('search.placeholderShort');
    const option = (item: { text: string; kind: string }, index: number) =>
      html`<div
        role="option"
        id="opt-${index}"
        aria-selected=${index === this.active ? 'true' : 'false'}
        @pointerdown=${(e: Event) => e.preventDefault()}
        @click=${() => this.#submit(item.text)}
      >
        <wa-icon name=${item.kind === 'history' ? 'history' : 'search'}></wa-icon>
        <span>${this.#highlight(item.text)}</span>
      </div>`;
    return html`
      <form role="search" @submit=${(e: Event) => (e.preventDefault(), this.#submit())}>
        <wa-icon class="icon" name="search"></wa-icon>
        <input
          type="search"
          role="combobox"
          aria-label=${this.t('search.label')}
          aria-expanded=${items.length ? 'true' : 'false'}
          aria-controls="listbox"
          aria-autocomplete="list"
          aria-activedescendant=${this.active >= 0 ? `opt-${this.active}` : nothing}
          autocomplete="off"
          enterkeyhint="search"
          spellcheck="false"
          placeholder=${placeholder}
          .value=${this.value}
          @input=${this.#onInput}
          @keydown=${this.#onKeydown}
          @focus=${() => ((this.#focused = true), (this.open = true))}
          @blur=${() => ((this.#focused = false), (this.open = false))}
        />
        ${
          multiWord
            ? html`<button
                type="button"
                class="chip"
                aria-pressed=${this.mode === 'and' ? 'true' : 'false'}
                title=${this.t(this.mode === 'and' ? 'search.mode.and' : 'search.mode.or')}
                @click=${() => (this.mode = this.mode === 'and' ? 'or' : 'and')}
              >
                ${this.t(this.mode === 'and' ? 'search.mode.andShort' : 'search.mode.orShort')}
              </button>`
            : nothing
        }
        ${
          this.aiAvailable
            ? html`<button
                type="button"
                class="chip"
                aria-pressed=${this.ai ? 'true' : 'false'}
                title=${this.t('search.ai.hint')}
                @click=${() => (this.ai = !this.ai)}
              >
                <wa-icon name="sparkles"></wa-icon><span>${this.t('search.ai')}</span>
              </button>`
            : nothing
        }
        ${
          this.value
            ? html`<button
                type="button"
                class="round"
                aria-label=${this.t('search.clear')}
                @click=${this.#clear}
              >
                <wa-icon name="x"></wa-icon>
              </button>`
            : nothing
        }
        <button type="submit" class="round submit" aria-label=${this.t('search.submit')}>
          <wa-icon name="arrow-right"></wa-icon>
        </button>
      </form>
      ${
        items.length
          ? html`<div class="panel" id="listbox" role="listbox" aria-label=${this.t('search.suggestions')}>
              ${
                history.length
                  ? html`<div class="section" role="presentation">
                        ${this.t('search.history')}
                        <button
                          type="button"
                          @pointerdown=${(e: Event) => e.preventDefault()}
                          @click=${() => (storage.remove(HISTORY_KEY), this.requestUpdate())}
                        >
                          ${this.t('search.historyClear')}
                        </button>
                      </div>
                      ${history.map((item, i) => option(item, i))}`
                  : nothing
              }
              ${
                suggestions.length
                  ? html`<div class="section" role="presentation">${this.t('search.suggestions')}</div>
                      ${suggestions.map((item, i) => option(item, i + history.length))}`
                  : nothing
              }
              <div class="hint" role="presentation">${this.t('search.help')}</div>
            </div>`
          : nothing
      }
    `;
  }
}

customElements.define('ep-search-bar', EpSearchBar);
