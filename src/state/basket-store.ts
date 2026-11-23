import type { AppConfig } from '../config/schema.ts';
import type { Asset } from '../data/model.ts';
import { Store, storage } from './store.ts';

export interface BasketItem {
  id: string;
  title: string;
  thumbnail: string;
  width?: number;
  height?: number;
  downloadable: boolean;
  /** Gewähltes Download-Format (Derivat). */
  format?: string;
}

interface BasketState {
  items: BasketItem[];
  open: boolean;
  termsAccepted: boolean;
}

const KEY = 'ep-basket';

/** Download-Auswahl («Korb»), dauerhaft im Browser gespeichert. */
export class BasketStore extends Store<BasketState> {
  constructor(private readonly config: AppConfig) {
    super({
      items: storage.get<BasketItem[]>(KEY, []),
      open: false,
      termsAccepted: storage.get<boolean>(`${KEY}-terms`, false),
    });
    // Änderungen aus anderen Tabs übernehmen.
    window.addEventListener('storage', (event) => {
      if (event.key === KEY) this.set({ items: storage.get<BasketItem[]>(KEY, []) });
    });
  }

  get count(): number {
    return this.state.items.length;
  }

  get max(): number {
    return this.config.basket.max;
  }

  has(id: string): boolean {
    return this.state.items.some((item) => item.id === id);
  }

  /** Fügt Assets hinzu; gibt die Anzahl tatsächlich hinzugefügter zurück. */
  add(
    assets: Array<Pick<Asset, 'id' | 'title' | 'thumbnail' | 'width' | 'height' | 'downloadable'>>,
  ): number {
    const items = [...this.state.items];
    let added = 0;
    for (const asset of assets) {
      if (items.length >= this.max) break;
      if (items.some((item) => item.id === asset.id)) continue;
      items.push({
        id: asset.id,
        title: asset.title,
        thumbnail: asset.thumbnail,
        width: asset.width,
        height: asset.height,
        downloadable: asset.downloadable,
      });
      added++;
    }
    this.#save(items);
    return added;
  }

  remove(id: string): void {
    this.#save(this.state.items.filter((item) => item.id !== id));
  }

  toggle(asset: Pick<Asset, 'id' | 'title' | 'thumbnail' | 'width' | 'height' | 'downloadable'>): boolean {
    if (this.has(asset.id)) {
      this.remove(asset.id);
      return false;
    }
    return this.add([asset]) > 0;
  }

  clear(): void {
    this.#save([]);
  }

  setFormat(id: string, format: string): void {
    this.#save(this.state.items.map((item) => (item.id === id ? { ...item, format } : item)));
  }

  setAllFormats(format: string): void {
    this.#save(this.state.items.map((item) => ({ ...item, format })));
  }

  acceptTerms(accepted: boolean): void {
    storage.set(`${KEY}-terms`, accepted);
    this.set({ termsAccepted: accepted });
  }

  setOpen(open: boolean): void {
    this.set({ open });
  }

  #save(items: BasketItem[]): void {
    storage.set(KEY, items);
    this.set({ items });
  }
}
