/**
 * Übersetzt Deep Links der bisherigen anura-App (Zustand im Hash, z. B.
 * `#detail-asset=<uuid>` oder `#search-text=zuerich&tree-node=<id>`) in neue URLs.
 * Gibt `null` zurück, wenn der Hash nichts Bekanntes enthält.
 */
export function legacyHashToPath(hash: string): string | null {
  const raw = hash.replace(/^#/, '');
  if (!raw.includes('=')) return null;

  const entries: Array<[string, string]> = [];
  for (const part of raw.split('&')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    try {
      entries.push([part.slice(0, index), decodeURIComponent(part.slice(index + 1).replace(/\+/g, ' '))]);
    } catch {
      entries.push([part.slice(0, index), part.slice(index + 1)]);
    }
  }
  if (entries.length === 0) return null;

  // 1. Detailansicht hat Vorrang (Lightbox-Prefix ist standardmässig «detail»).
  const asset = entries.find(([key]) => key === 'detail-asset' || key.endsWith('-asset'));
  if (asset?.[1]) return `/bild/${encodeURIComponent(asset[1])}`;

  // 2. Geteilter Download-Korb: #add-<basketId>=id1,id2
  const basket = entries.find(([key]) => key.startsWith('add-') || key === 'add');
  if (basket?.[1]) {
    const ids = basket[1].split(',').filter(Boolean);
    return `/auswahl?${new URLSearchParams({ ids: ids.join(',') }).toString()}`;
  }

  // 3. Suchzustand der einzelnen Komponenten (<instanz>-<schlüssel>=wert).
  const params = new URLSearchParams();
  for (const [key, value] of entries) {
    if (!value) continue;
    const dash = key.indexOf('-');
    const field = dash >= 0 ? key.slice(dash + 1) : key;
    if (field === 'text') params.set('q', value);
    else if (field === 'mode') {
      if (value === 'and') params.set('mode', 'and');
    } else if (field === 'node') params.set('cat', value);
    else if (/^(\d{4}-\d{2}-\d{2}|null)?,(\d{4}-\d{2}-\d{2}|null)?$/.test(value)) {
      const [from, to] = value.split(',').map((d) => (d === 'null' ? '' : d));
      params.set(`d.${field}`, `${from}..${to}`);
    } else {
      for (const item of value.split(',').filter(Boolean)) params.append(`f.${field}`, item);
    }
  }
  const query = params.toString();
  return query ? `/suche?${query}` : null;
}
