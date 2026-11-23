/** Reihenlayout für das «Justified Grid» (gleich hohe Reihen, Seitenverhältnisse bleiben erhalten). */

export interface JustifiedItem {
  id: string;
  ratio: number;
}

export interface JustifiedRow {
  items: Array<{ id: string; width: number }>;
  height: number;
  /** Letzte, nicht gestreckte Reihe. */
  partial: boolean;
}

export function justify(
  items: JustifiedItem[],
  containerWidth: number,
  targetHeight: number,
  gap: number,
  maxStretch = 1.6,
): JustifiedRow[] {
  const rows: JustifiedRow[] = [];
  if (containerWidth <= 0) return rows;
  let current: JustifiedItem[] = [];
  let ratioSum = 0;
  for (const item of items) {
    const ratio = Math.min(4, Math.max(0.25, item.ratio || 1.5));
    current.push({ id: item.id, ratio });
    ratioSum += ratio;
    const width = ratioSum * targetHeight + gap * (current.length - 1);
    if (width >= containerWidth) {
      const height = (containerWidth - gap * (current.length - 1)) / ratioSum;
      rows.push(toRow(current, height, false));
      current = [];
      ratioSum = 0;
    }
  }
  if (current.length) {
    // Letzte Reihe nicht auf volle Breite ziehen, aber leicht anpassen, falls sie fast voll ist.
    const natural = (containerWidth - gap * (current.length - 1)) / ratioSum;
    const height = Math.min(targetHeight * maxStretch, natural, targetHeight * 1.12);
    rows.push(toRow(current, height, natural > targetHeight * 1.12));
  }
  return rows;
}

function toRow(items: JustifiedItem[], height: number, partial: boolean): JustifiedRow {
  return {
    height: Math.round(height),
    partial,
    items: items.map((item) => ({ id: item.id, width: Math.round(item.ratio * height * 100) / 100 })),
  };
}
