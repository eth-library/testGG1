/**
 * Kleine, abhängigkeitsfreie Farbhilfen (sRGB ⇄ OKLab/OKLCH, WCAG-Kontrast).
 * Wird im Browser (Theme-Generierung) und im Build-Skript `check-themes` verwendet.
 */

export type Rgb = [number, number, number];
export type Oklch = { l: number; c: number; h: number };

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : value;
  const n = Number.parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  const to = (x: number) =>
    Math.round(Math.min(255, Math.max(0, x)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

const toLinear = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (c: number) => {
  const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return s * 255;
};

function rgbToOklab([r, g, b]: Rgb): [number, number, number] {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinearRgb([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function hexToOklch(hex: string): Oklch {
  const [L, a, b] = rgbToOklab(hexToRgb(hex));
  const c = Math.sqrt(a * a + b * b);
  const h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

const inGamut = (rgb: [number, number, number]) => rgb.every((x) => x >= -0.0001 && x <= 1.0001);

/** OKLCH → Hex; reduziert die Sättigung, bis die Farbe im sRGB-Raum liegt. */
export function oklchToHex({ l, c, h }: Oklch): string {
  const rad = (h * Math.PI) / 180;
  let chroma = c;
  let lin = oklabToLinearRgb([l, chroma * Math.cos(rad), chroma * Math.sin(rad)]);
  for (let i = 0; i < 40 && !inGamut(lin); i++) {
    chroma *= 0.92;
    lin = oklabToLinearRgb([l, chroma * Math.cos(rad), chroma * Math.sin(rad)]);
  }
  return rgbToHex(lin.map((x) => fromLinear(Math.min(1, Math.max(0, x)))) as Rgb);
}

/** Mischt zwei Farben in OKLab (t = Anteil von `b`). */
export function mix(a: string, b: string, t: number): string {
  const la = rgbToOklab(hexToRgb(a));
  const lb = rgbToOklab(hexToRgb(b));
  const m: [number, number, number] = [0, 1, 2].map((i) => la[i] + (lb[i] - la[i]) * t) as [
    number,
    number,
    number,
  ];
  return rgbToHex(oklabToLinearRgb(m).map((x) => fromLinear(Math.min(1, Math.max(0, x)))) as Rgb);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG-2.x-Kontrastverhältnis (1–21). */
export function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Wählt die lesbarere von zwei Textfarben für einen Hintergrund. */
export function bestOn(background: string, light = '#FFFFFF', dark = '#111111'): string {
  return contrast(background, light) >= contrast(background, dark) ? light : dark;
}

export const TINTS = ['95', '90', '80', '70', '60', '50', '40', '30', '20', '10', '05'] as const;
const TINT_LIGHTNESS: Record<(typeof TINTS)[number], number> = {
  '95': 0.965,
  '90': 0.925,
  '80': 0.845,
  '70': 0.755,
  '60': 0.665,
  '50': 0.575,
  '40': 0.485,
  '30': 0.405,
  '20': 0.325,
  '10': 0.245,
  '05': 0.185,
};

/**
 * Erzeugt eine Tönungsskala (95 = hell … 05 = dunkel) im Farbton von `hex`.
 * `chromaScale` dämpft die Sättigung (z. B. für Neutraltöne).
 */
export function tintScale(hex: string, chromaScale = 1): Record<string, string> {
  const base = hexToOklch(hex);
  const scale: Record<string, string> = {};
  for (const tint of TINTS) {
    const l = TINT_LIGHTNESS[tint];
    // Sättigung zu den Rändern hin reduzieren, damit helle/dunkle Stufen nicht grell wirken.
    const falloff = 1 - Math.abs(l - 0.55) * 1.1;
    scale[tint] = oklchToHex({ l, c: base.c * chromaScale * Math.max(0.18, falloff), h: base.h });
  }
  return scale;
}
