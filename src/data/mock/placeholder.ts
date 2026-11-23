/**
 * Erzeugt stimmungsvolle Platzhalterbilder (SVG) im Stil historischer Fotografien.
 * Nur für den Demo-Modus – keine echten Archivbilder.
 */

export type Scene = 'alps' | 'lake' | 'city' | 'portrait' | 'aerial' | 'lab' | 'campus' | 'postcard';

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

interface Tone {
  paper: string;
  light: string;
  mid: string;
  dark: string;
  ink: string;
}

const TONES: Tone[] = [
  { paper: '#efe6d4', light: '#d9c9a8', mid: '#a68f6a', dark: '#5c4a33', ink: '#2a2117' }, // Sepia
  { paper: '#ecebe7', light: '#cfcdc6', mid: '#8f8c85', dark: '#4a4845', ink: '#1c1b1a' }, // S/W
  { paper: '#e9e4da', light: '#c9c2b2', mid: '#8d8575', dark: '#4d4639', ink: '#221e18' }, // Silbergelatine
  { paper: '#e3e8e6', light: '#bccbc8', mid: '#7f9490', dark: '#3d4c4a', ink: '#18201f' }, // Cyanotypie-Anmutung
  { paper: '#efe2cf', light: '#e0b98c', mid: '#b07c52', dark: '#5e3c27', ink: '#2b1a10' }, // Farbdia, verblasst
];

const f = (n: number) => n.toFixed(1);

function ridge(r: () => number, w: number, h: number, base: number, amp: number, steps: number): string {
  let d = `M0 ${f(h)} L0 ${f(base)}`;
  let y = base;
  for (let i = 1; i <= steps; i++) {
    const x = (w / steps) * i;
    y = Math.min(h, Math.max(base - amp, y + (r() - 0.5) * amp * 0.9));
    const peak = r() > 0.7 ? -amp * 0.35 * r() : 0;
    d += ` L${f(x - w / steps / 2)} ${f(y + peak)} L${f(x)} ${f(y)}`;
  }
  return `${d} L${f(w)} ${f(h)} Z`;
}

function scene(kind: Scene, r: () => number, w: number, h: number, t: Tone): string {
  const parts: string[] = [];
  switch (kind) {
    case 'alps': {
      parts.push(`<path d="${ridge(r, w, h, h * 0.42, h * 0.3, 7)}" fill="${t.mid}" opacity=".75"/>`);
      parts.push(`<path d="${ridge(r, w, h, h * 0.55, h * 0.22, 9)}" fill="${t.dark}" opacity=".85"/>`);
      parts.push(`<path d="${ridge(r, w, h, h * 0.75, h * 0.1, 12)}" fill="${t.ink}"/>`);
      // Schneefelder
      for (let i = 0; i < 4; i++) {
        const x = r() * w;
        parts.push(
          `<path d="M${f(x)} ${f(h * 0.33)} l${f(w * 0.04)} ${f(h * 0.07)} l-${f(w * 0.07)} 0 Z" fill="${t.paper}" opacity=".7"/>`,
        );
      }
      break;
    }
    case 'lake': {
      parts.push(`<path d="${ridge(r, w, h, h * 0.5, h * 0.18, 8)}" fill="${t.dark}" opacity=".8"/>`);
      parts.push(`<rect x="0" y="${f(h * 0.6)}" width="${w}" height="${f(h * 0.4)}" fill="url(#water)"/>`);
      for (let i = 0; i < 9; i++) {
        const y = h * (0.64 + r() * 0.33);
        parts.push(
          `<rect x="${f(r() * w * 0.8)}" y="${f(y)}" width="${f(w * (0.05 + r() * 0.2))}" height="1.5" fill="${t.paper}" opacity=".35"/>`,
        );
      }
      // Segelboot
      const bx = w * (0.2 + r() * 0.6);
      parts.push(
        `<path d="M${f(bx)} ${f(h * 0.7)} l${f(w * 0.03)} -${f(h * 0.1)} l0 ${f(h * 0.1)} Z" fill="${t.ink}" opacity=".8"/>`,
      );
      break;
    }
    case 'city':
    case 'campus': {
      const ground = h * 0.78;
      let x = -10;
      while (x < w) {
        const bw = w * (0.05 + r() * 0.1);
        const bh = h * (kind === 'campus' ? 0.25 + r() * 0.2 : 0.15 + r() * 0.4);
        parts.push(
          `<rect x="${f(x)}" y="${f(ground - bh)}" width="${f(bw)}" height="${f(bh)}" fill="${r() > 0.5 ? t.dark : t.mid}"/>`,
        );
        if (r() > 0.6) {
          parts.push(
            `<path d="M${f(x)} ${f(ground - bh)} l${f(bw / 2)} -${f(h * 0.08)} l${f(bw / 2)} ${f(h * 0.08)} Z" fill="${t.dark}"/>`,
          );
        }
        for (let wy = ground - bh + 8; wy < ground - 8; wy += 14) {
          for (let wx = x + 5; wx < x + bw - 6; wx += 11) {
            if (r() > 0.35)
              parts.push(
                `<rect x="${f(wx)}" y="${f(wy)}" width="4" height="7" fill="${t.light}" opacity=".55"/>`,
              );
          }
        }
        x += bw + w * 0.01;
      }
      if (kind === 'campus') {
        const cx = w * 0.5;
        parts.push(
          `<rect x="${f(cx - w * 0.18)}" y="${f(ground - h * 0.38)}" width="${f(w * 0.36)}" height="${f(h * 0.38)}" fill="${t.mid}"/>`,
        );
        parts.push(
          `<ellipse cx="${f(cx)}" cy="${f(ground - h * 0.38)}" rx="${f(w * 0.07)}" ry="${f(h * 0.09)}" fill="${t.dark}"/>`,
        );
        for (let i = 0; i < 8; i++) {
          parts.push(
            `<rect x="${f(cx - w * 0.16 + i * w * 0.042)}" y="${f(ground - h * 0.3)}" width="${f(w * 0.012)}" height="${f(h * 0.28)}" fill="${t.paper}" opacity=".5"/>`,
          );
        }
      }
      parts.push(
        `<rect x="0" y="${f(ground)}" width="${w}" height="${f(h - ground)}" fill="${t.ink}" opacity=".85"/>`,
      );
      break;
    }
    case 'portrait': {
      parts.push(`<rect width="${w}" height="${h}" fill="url(#studio)"/>`);
      const cx = w * (0.45 + r() * 0.1);
      parts.push(
        `<path d="M${f(cx - w * 0.32)} ${h} C${f(cx - w * 0.3)} ${f(h * 0.7)} ${f(cx - w * 0.16)} ${f(h * 0.62)} ${f(cx)} ${f(h * 0.62)} C${f(cx + w * 0.16)} ${f(h * 0.62)} ${f(cx + w * 0.3)} ${f(h * 0.7)} ${f(cx + w * 0.32)} ${h} Z" fill="${t.ink}"/>`,
      );
      parts.push(
        `<ellipse cx="${f(cx)}" cy="${f(h * 0.42)}" rx="${f(w * 0.13)}" ry="${f(h * 0.15)}" fill="${t.mid}"/>`,
      );
      parts.push(
        `<path d="M${f(cx - w * 0.13)} ${f(h * 0.38)} q${f(w * 0.13)} -${f(h * 0.2)} ${f(w * 0.26)} 0 q-${f(w * 0.05)} -${f(h * 0.06)} -${f(w * 0.13)} -${f(h * 0.06)} Z" fill="${t.dark}"/>`,
      );
      parts.push(
        `<rect x="${f(cx - w * 0.035)} y="${f(h * 0.56)}" width="${f(w * 0.07)}" height="${f(h * 0.07)}" fill="${t.mid}"/>`,
      );
      break;
    }
    case 'aerial': {
      const cols = 6 + Math.floor(r() * 4);
      const rows = 5 + Math.floor(r() * 4);
      const tones = [t.light, t.mid, t.dark, t.paper];
      parts.push(
        `<g transform="rotate(${f(-12 + r() * 24)} ${w / 2} ${h / 2}) scale(1.35) translate(-${f(w * 0.13)} -${f(h * 0.13)})">`,
      );
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          parts.push(
            `<rect x="${f((w / cols) * i)}" y="${f((h / rows) * j)}" width="${f(w / cols - 2)}" height="${f(h / rows - 2)}" fill="${tones[Math.floor(r() * tones.length)]}" opacity="${f(0.55 + r() * 0.45)}"/>`,
          );
        }
      }
      parts.push(`</g>`);
      parts.push(
        `<path d="M0 ${f(h * (0.3 + r() * 0.4))} C${f(w * 0.3)} ${f(h * r())} ${f(w * 0.6)} ${f(h * r())} ${w} ${f(h * (0.3 + r() * 0.4))}" stroke="${t.ink}" stroke-width="${f(w * 0.018)}" fill="none" opacity=".8"/>`,
      );
      break;
    }
    case 'lab': {
      parts.push(`<rect width="${w}" height="${h}" fill="url(#studio)"/>`);
      parts.push(`<rect x="0" y="${f(h * 0.68)}" width="${w}" height="${f(h * 0.32)}" fill="${t.dark}"/>`);
      for (let i = 0; i < 6; i++) {
        const x = w * (0.08 + i * 0.15 + r() * 0.04);
        const bh = h * (0.12 + r() * 0.22);
        if (r() > 0.5) {
          parts.push(
            `<circle cx="${f(x)}" cy="${f(h * 0.68 - bh / 2)}" r="${f(bh / 2)}" fill="${t.light}" stroke="${t.ink}" stroke-width="2" opacity=".85"/>`,
          );
        } else {
          parts.push(
            `<rect x="${f(x - w * 0.025)}" y="${f(h * 0.68 - bh)}" width="${f(w * 0.05)}" height="${f(bh)}" fill="${t.mid}" stroke="${t.ink}" stroke-width="2"/>`,
          );
        }
      }
      parts.push(
        `<rect x="${f(w * 0.06)}" y="${f(h * 0.12)}" width="${f(w * 0.3)}" height="${f(h * 0.3)}" fill="${t.paper}" opacity=".35" stroke="${t.dark}"/>`,
      );
      break;
    }
    case 'postcard': {
      parts.push(`<path d="${ridge(r, w, h, h * 0.46, h * 0.22, 8)}" fill="${t.mid}" opacity=".8"/>`);
      parts.push(`<rect x="0" y="${f(h * 0.66)}" width="${w}" height="${f(h * 0.34)}" fill="url(#water)"/>`);
      parts.push(
        `<rect x="${f(w * 0.04)}" y="${f(h * 0.05)}" width="${f(w * 0.92)}" height="${f(h * 0.9)}" fill="none" stroke="${t.paper}" stroke-width="${f(w * 0.012)}"/>`,
      );
      break;
    }
  }
  return parts.join('');
}

export interface PlaceholderOptions {
  id: string;
  scene: Scene;
  width: number;
  height: number;
  /** Ausgabegrösse (lange Kante) in Pixeln. */
  size: number;
  grain?: boolean;
}

export function placeholderSvg({ id, scene: kind, width, height, size, grain }: PlaceholderOptions): string {
  const r = rng(hashString(id));
  const tone = TONES[Math.floor(r() * TONES.length)];
  const w = 600;
  const h = Math.round((600 * height) / width);
  const scale = size / Math.max(width, height);
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);
  const sun = r() > 0.5;
  const content = scene(kind, r, w, h, tone);
  const filter = grain
    ? `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0"/></filter>`
    : '';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">`,
    `<defs>`,
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone.light}"/><stop offset="1" stop-color="${tone.paper}"/></linearGradient>`,
    `<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone.mid}"/><stop offset="1" stop-color="${tone.dark}"/></linearGradient>`,
    `<radialGradient id="studio" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="${tone.light}"/><stop offset="1" stop-color="${tone.dark}"/></radialGradient>`,
    `<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>`,
    filter,
    `</defs>`,
    `<rect width="${w}" height="${h}" fill="url(#sky)"/>`,
    sun
      ? `<circle cx="${f(w * (0.15 + r() * 0.7))}" cy="${f(h * 0.2)}" r="${f(h * 0.07)}" fill="${tone.paper}" opacity=".8"/>`
      : '',
    content,
    `<rect width="${w}" height="${h}" fill="url(#vig)"/>`,
    grain ? `<rect width="${w}" height="${h}" filter="url(#g)"/>` : '',
    `</svg>`,
  ].join('');
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
