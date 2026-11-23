/**
 * Prüft alle Farbthemes der Konfiguration auf WCAG-AA-Kontraste (hell und dunkel).
 * Aufruf: npm run check:themes [-- pfad/zur/config.json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveConfig } from '../src/config/load-config.ts';
import { contrast } from '../src/theme/color.ts';
import { deriveTokens } from '../src/theme/theme-css.ts';

const candidates = [process.argv[2], 'public/config/config.json', 'public/config/config.example.json'].filter(
  (p): p is string => !!p,
);
const file = candidates.map((p) => resolve(p)).find((p) => existsSync(p));
if (!file) {
  console.error('Keine Konfigurationsdatei gefunden.');
  process.exit(1);
}
const raw = JSON.parse(readFileSync(file, 'utf8'));
const config = resolveConfig({ ...raw, api: { ...raw.api, mock: true } });

const checks: Array<[string, string, string, number]> = [];
let failed = 0;
for (const [name, theme] of Object.entries(config.theme.themes)) {
  for (const scheme of ['light', 'dark'] as const) {
    const t = theme[scheme];
    const tokens = deriveTokens(t, scheme);
    checks.length = 0;
    checks.push(
      ['Text / Hintergrund', t.text, t.bg, 4.5],
      ['Text / Fläche', t.text, t.surface, 4.5],
      ['Gedämpfter Text / Hintergrund', t.muted, t.bg, 4.5],
      ['Gedämpfter Text / Fläche', t.muted, t.surface, 4.5],
      ['Akzent als Text / Hintergrund', tokens['--ep-accent-text'], t.bg, 4.5],
      ['Text auf Akzent', tokens['--ep-accent-on'], t.accent, 4.5],
      ['Akzent / Hintergrund (UI-Element)', t.accent, t.bg, 3],
    );
    for (const [label, fg, bg, min] of checks) {
      const ratio = contrast(fg, bg);
      if (ratio < min) {
        failed++;
        console.error(`✗ ${name} (${scheme}) – ${label}: ${ratio.toFixed(2)} < ${min}  [${fg} auf ${bg}]`);
      }
    }
  }
}
if (failed) {
  console.error(`\n${failed} Kontrastprüfung(en) nicht bestanden (${file}).`);
  process.exit(1);
}
console.log(`✓ Alle Themes erfüllen WCAG AA (${Object.keys(config.theme.themes).length} Themes, ${file}).`);
