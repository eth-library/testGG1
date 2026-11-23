import { describe, expect, it } from 'vitest';
import { ConfigError, deepMerge, resolveConfig } from '../../src/config/load-config.ts';
import { DEFAULT_CONFIG } from '../../src/config/defaults.ts';
import { contrast, hexToOklch, mix, oklchToHex, TINTS, tintScale } from '../../src/theme/color.ts';
import { deriveTokens } from '../../src/theme/theme-css.ts';
import { format } from '../../src/i18n/i18n.ts';

describe('Konfiguration', () => {
  it('führt Objekte tief zusammen und ersetzt Arrays', () => {
    expect(deepMerge({ a: { b: 1, c: 2 }, l: [1, 2] }, { a: { c: 3 }, l: [9] })).toEqual({
      a: { b: 1, c: 3 },
      l: [9],
    });
  });

  it('ergänzt Vorgaben', () => {
    const config = resolveConfig({ api: { mock: true } });
    expect(config.catalog.pageSize).toBe(60);
    expect(config.theme.themes['eth-blau']).toBeDefined();
  });

  it('meldet ungültige Werte mit Pfad', () => {
    try {
      resolveConfig({ api: { mock: true }, theme: { active: 'gibt-es-nicht' } });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).issues[0]).toContain('theme.active');
    }
    expect(() => resolveConfig({ api: { mock: true }, catalog: { pageSize: 5 } })).toThrow(ConfigError);
    expect(() =>
      resolveConfig({ api: { mock: true }, theme: { themes: { x: { light: { accent: 'blau' } } } } }),
    ).toThrow(ConfigError);
  });

  it('verlangt eine API-Adresse ausserhalb des Demo-Modus', () => {
    expect(() => resolveConfig({})).toThrow(ConfigError);
    try {
      resolveConfig({});
    } catch (error) {
      expect((error as ConfigError).issues.join()).toContain('api.baseUrl');
    }
  });
});

describe('Farben und Theme-Tokens', () => {
  it('rechnet sRGB ⇄ OKLCH verlustarm um', () => {
    for (const hex of ['#215CAF', '#FAF9F6', '#0E0E10', '#7F5C10']) {
      expect(oklchToHex(hexToOklch(hex))).toBe(hex);
    }
  });

  it('berechnet WCAG-Kontraste', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });

  it('mischt Farben', () => {
    expect(mix('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mix('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
  });

  it('erzeugt eine von hell nach dunkel abfallende Skala', () => {
    const scale = tintScale('#215CAF');
    const l = TINTS.map((tint) => hexToOklch(scale[tint]).l);
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeLessThan(l[i - 1]);
  });

  it('alle mitgelieferten Themes erfüllen WCAG AA für Text', () => {
    for (const [name, theme] of Object.entries(DEFAULT_CONFIG.theme.themes)) {
      for (const scheme of ['light', 'dark'] as const) {
        const t = theme[scheme];
        const tokens = deriveTokens(t, scheme);
        expect(contrast(t.text, t.bg), `${name}/${scheme} text`).toBeGreaterThanOrEqual(7);
        expect(contrast(t.muted, t.bg), `${name}/${scheme} muted`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tokens['--ep-accent-text'], t.bg), `${name}/${scheme} accent`).toBeGreaterThanOrEqual(
          4.5,
        );
        expect(
          contrast(tokens['--ep-accent-on'], t.accent),
          `${name}/${scheme} on-accent`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('Übersetzungen', () => {
  it('ersetzt Platzhalter und wählt Pluralformen', () => {
    expect(format('Keine|1 Treffer|{count} Treffer', { count: 0 })).toBe('Keine');
    expect(format('Keine|1 Treffer|{count} Treffer', { count: 1 })).toBe('1 Treffer');
    expect(format('Keine|1 Treffer|{count} Treffer', { count: 12345 }, 'de')).toMatch(/^12.345 Treffer$/);
    expect(format('Hallo {name}', { name: 'Welt' })).toBe('Hallo Welt');
  });
});
