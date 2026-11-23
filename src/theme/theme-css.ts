import type { ThemeTokenSet } from '../config/schema.ts';
import { bestOn, contrast, mix, tintScale } from './color.ts';

/**
 * Leitet aus den wenigen Theme-Tokens der Config alle CSS-Variablen ab:
 * eigene `--ep-*`-Variablen und die Design-Tokens von Web Awesome (`--wa-*`).
 */
export function deriveTokens(t: ThemeTokenSet, scheme: 'light' | 'dark'): Record<string, string> {
  const raised = t.raised ?? t.surface;
  const border = t.border ?? mix(t.surface, t.text, 0.12);
  const accentOn = bestOn(t.accent, '#FFFFFF', '#101010');
  // Akzent als Textfarbe muss auf dem Hintergrund lesbar sein – sonst Richtung Text verschieben.
  let accentText = t.accent;
  for (let i = 1; i <= 10 && contrast(accentText, t.bg) < 4.5; i++)
    accentText = mix(t.accent, t.text, i * 0.1);

  const brand = tintScale(t.accent);
  const neutral = tintScale(mix(t.bg, t.text, 0.5), 0.35);

  const vars: Record<string, string> = {
    'color-scheme': scheme,
    '--ep-bg': t.bg,
    '--ep-surface': t.surface,
    '--ep-raised': raised,
    '--ep-text': t.text,
    '--ep-muted': t.muted,
    '--ep-border': border,
    '--ep-border-strong': mix(border, t.text, 0.25),
    '--ep-accent': t.accent,
    '--ep-accent-on': accentOn,
    '--ep-accent-text': accentText,
    '--ep-accent-soft': mix(t.surface, t.accent, scheme === 'light' ? 0.09 : 0.16),
    '--ep-hover': mix(t.surface, t.text, 0.05),
    '--ep-lowered': mix(t.bg, t.text, scheme === 'light' ? 0.035 : 0.06),
    '--ep-glass': `color-mix(in oklab, ${t.bg} 72%, transparent)`,
    '--ep-scrim': scheme === 'light' ? 'rgb(14 14 16 / 0.86)' : 'rgb(0 0 0 / 0.9)',
    '--ep-shadow-color': scheme === 'light' ? 'rgb(28 24 18 / 0.10)' : 'rgb(0 0 0 / 0.5)',
    '--ep-placeholder': mix(t.bg, t.text, scheme === 'light' ? 0.07 : 0.1),

    '--wa-color-surface-default': t.surface,
    '--wa-color-surface-raised': raised,
    '--wa-color-surface-lowered': mix(t.bg, t.text, scheme === 'light' ? 0.035 : 0.06),
    '--wa-color-surface-border': border,
    '--wa-color-text-normal': t.text,
    '--wa-color-text-quiet': t.muted,
    '--wa-color-text-link': accentText,
    '--wa-color-focus': t.accent,
    '--wa-color-brand-fill-loud': t.accent,
    '--wa-color-brand-on-loud': accentOn,
    '--wa-color-brand-fill-normal': mix(t.surface, t.accent, 0.18),
    '--wa-color-brand-fill-quiet': mix(t.surface, t.accent, 0.09),
    '--wa-color-brand-border-loud': t.accent,
    '--wa-color-brand-border-normal': mix(t.surface, t.accent, 0.45),
    '--wa-color-brand-border-quiet': mix(t.surface, t.accent, 0.25),
    '--wa-color-brand-on-normal': accentText,
    '--wa-color-brand-on-quiet': accentText,
    '--wa-color-neutral-fill-loud': t.text,
    '--wa-color-neutral-on-loud': t.surface,
    '--wa-color-neutral-fill-normal': mix(t.surface, t.text, 0.09),
    '--wa-color-neutral-fill-quiet': mix(t.surface, t.text, 0.045),
    '--wa-color-neutral-border-loud': mix(t.surface, t.text, 0.45),
    '--wa-color-neutral-border-normal': mix(t.surface, t.text, 0.2),
    '--wa-color-neutral-border-quiet': border,
    '--wa-color-neutral-on-normal': t.text,
    '--wa-color-neutral-on-quiet': t.text,
    '--wa-color-overlay-modal': scheme === 'light' ? 'rgb(20 18 14 / 0.42)' : 'rgb(0 0 0 / 0.62)',
  };
  for (const [tint, value] of Object.entries(brand)) vars[`--wa-color-brand-${tint}`] = value;
  for (const [tint, value] of Object.entries(neutral)) vars[`--wa-color-neutral-${tint}`] = value;
  return vars;
}

export function tokensToCss(selector: string, vars: Record<string, string>): string {
  const body = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  return `${selector} {\n${body}\n}`;
}
