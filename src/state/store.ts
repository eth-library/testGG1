import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Minimaler beobachtbarer Zustand. Komponenten abonnieren ihn über `StoreController`. */
export class Store<T extends object> extends EventTarget {
  #state: T;

  constructor(initial: T) {
    super();
    this.#state = initial;
  }

  get state(): Readonly<T> {
    return this.#state;
  }

  set(patch: Partial<T>): void {
    this.#state = { ...this.#state, ...patch };
    this.dispatchEvent(new Event('change'));
  }

  replace(next: T): void {
    this.#state = next;
    this.dispatchEvent(new Event('change'));
  }

  subscribe(listener: () => void): () => void {
    this.addEventListener('change', listener);
    return () => this.removeEventListener('change', listener);
  }
}

type Subscribable = { subscribe(listener: () => void): () => void };

/** Rendert den Host neu, sobald sich eine der Quellen ändert. */
export class StoreController implements ReactiveController {
  #unsubscribe: Array<() => void> = [];
  readonly #sources: Subscribable[];
  readonly #host: ReactiveControllerHost;

  constructor(host: ReactiveControllerHost, ...sources: Subscribable[]) {
    this.#host = host;
    this.#sources = sources;
    host.addController(this);
  }

  hostConnected(): void {
    this.#unsubscribe = this.#sources.map((source) => source.subscribe(() => this.#host.requestUpdate()));
  }

  hostDisconnected(): void {
    this.#unsubscribe.forEach((fn) => fn());
    this.#unsubscribe = [];
  }
}

/** Sicherer Zugriff auf localStorage (privater Modus, blockierte Site-Daten). */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* Speicher nicht verfügbar – ignorieren */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignorieren */
    }
  },
};
