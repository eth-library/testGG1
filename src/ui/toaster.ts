import { Store } from '../state/store.ts';

export interface Toast {
  id: number;
  message: string;
  variant: 'neutral' | 'success' | 'danger';
  icon?: string;
}

/** Kurze, nicht blockierende Meldungen (dargestellt von <ep-toasts>). */
export class Toaster extends Store<{ toasts: Toast[] }> {
  #next = 1;

  constructor() {
    super({ toasts: [] });
  }

  show(
    message: string,
    options: { variant?: Toast['variant']; icon?: string; duration?: number } = {},
  ): void {
    const toast: Toast = {
      id: this.#next++,
      message,
      variant: options.variant ?? 'neutral',
      icon: options.icon,
    };
    this.set({ toasts: [...this.state.toasts.slice(-2), toast] });
    window.setTimeout(() => this.dismiss(toast.id), options.duration ?? 3600);
  }

  dismiss(id: number): void {
    this.set({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  }
}
