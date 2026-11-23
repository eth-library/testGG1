import { app } from '../app/services.ts';
import { saveBlob } from '../data/sharedien/client.ts';

/** Erzeugt eine CSV-Zeile (RFC 4180, Felder mit Trennzeichen/Anführungszeichen/Zeilenumbruch quotiert). */
export function csvLine(values: string[], delimiter: string): string {
  return values
    .map((value) => {
      const text = value ?? '';
      return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(delimiter);
}

/**
 * Exportiert die Metadaten der angegebenen Bilder als CSV (UTF-8 mit BOM für Excel).
 * Läuft vollständig im Browser – keine Export-Berechtigung in Sharedien nötig.
 */
export async function exportCsv(
  ids: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const { catalog, config, router, i18n } = app();
  const defs = catalog.fieldDefinitions();
  const fields = config.export.fields.length
    ? config.export.fields
    : [...defs.values()].filter((d) => !config.detail.hiddenFields.includes(d.id)).map((d) => d.id);
  const delimiter = config.export.delimiter;
  const header = ['ID', ...fields.map((f) => defs.get(f)?.label ?? f), 'Link'];
  const lines = [csvLine(header, delimiter)];
  let done = 0;
  const queue = [...ids];
  const rows = new Map<string, string[]>();
  const worker = async () => {
    while (queue.length) {
      const id = queue.shift()!;
      try {
        const detail = await catalog.getAsset(id);
        const all = new Map(detail.groups.flatMap((g) => g.fields).map((f) => [f.id, f.values]));
        rows.set(id, [
          id,
          ...fields.map((f) => (all.get(f) ?? detail.fields[f] ?? []).map((v) => v.label).join(' | ')),
          new URL(router.href(`/bild/${encodeURIComponent(id)}`), location.origin).href,
        ]);
      } catch {
        rows.set(id, [id]);
      }
      onProgress?.(++done, ids.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, ids.length) }, worker));
  for (const id of ids) lines.push(csvLine(rows.get(id) ?? [id], delimiter));
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob(['﻿', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  saveBlob(blob, `${i18n.locale === 'de' ? 'bildarchiv-metadaten' : 'image-archive-metadata'}-${stamp}.csv`);
  return ids.length;
}
