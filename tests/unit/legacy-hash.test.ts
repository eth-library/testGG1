import { describe, expect, it } from 'vitest';
import { legacyHashToPath } from '../../src/router/legacy-hash.ts';

describe('Alte anura-Deep-Links', () => {
  it('leitet Detailansichten weiter', () => {
    expect(legacyHashToPath('#detail-asset=bcf52020-9de4-444c-95db-4b6932533e63')).toBe(
      '/bild/bcf52020-9de4-444c-95db-4b6932533e63',
    );
  });

  it('bevorzugt das Detail auch bei weiterem Zustand', () => {
    expect(legacyHashToPath('#search-text=bern&detail-asset=abc')).toBe('/bild/abc');
  });

  it('übernimmt geteilte Download-Körbe', () => {
    expect(legacyHashToPath('#add-basket=a,b,c')).toBe('/auswahl?ids=a%2Cb%2Cc');
  });

  it('bildet Suchtext, Modus, Kategorie, Facetten und Datum ab', () => {
    const path = legacyHashToPath(
      '#search-text=Gletscher%20Rhone&search-mode=and&tree-node=cat_1&select-ba_photographer=ph_a,ph_b&date-ba_date=1900-01-01,null',
    );
    const url = new URL(path!, 'https://x.ch');
    expect(url.pathname).toBe('/suche');
    expect(url.searchParams.get('q')).toBe('Gletscher Rhone');
    expect(url.searchParams.get('mode')).toBe('and');
    expect(url.searchParams.get('cat')).toBe('cat_1');
    expect(url.searchParams.getAll('f.ba_photographer')).toEqual(['ph_a', 'ph_b']);
    expect(url.searchParams.get('d.ba_date')).toBe('1900-01-01..');
  });

  it('ignoriert gewöhnliche Anker', () => {
    expect(legacyHashToPath('#main')).toBeNull();
    expect(legacyHashToPath('')).toBeNull();
  });
});
