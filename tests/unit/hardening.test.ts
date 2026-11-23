import { describe, expect, it } from 'vitest';
import { csvLine, neutralizeFormula } from '../../src/features/export-csv.ts';
import { matchRoute } from '../../src/router/router.ts';
import { paramsToState } from '../../src/state/search-state.ts';

describe('CSV-Export', () => {
  it('neutralisiert Formeln am Wertanfang', () => {
    for (const value of ['=HYPERLINK("x")', '+1+1', '-2', '@SUM(A1)', '\tcmd', '\rcmd']) {
      expect(neutralizeFormula(value).startsWith("'")).toBe(true);
    }
    expect(neutralizeFormula('Zürich, 1910')).toBe('Zürich, 1910');
  });

  it('neutralisiert auch quotierte Felder', () => {
    expect(csvLine(['=1;2', 'ok'], ';')).toBe(`"'=1;2";ok`);
    expect(csvLine(['a "b"', 'c'], ';')).toBe('"a ""b""";c');
  });
});

describe('Router', () => {
  it('liefert «nicht gefunden» bei fehlerhafter Prozent-Kodierung', () => {
    expect(matchRoute('/bild/%ZZ')).toEqual({ name: 'notFound' });
    expect(matchRoute('/sammlung/%E0%A4%A')).toEqual({ name: 'notFound' });
    expect(matchRoute('/bild/abc%20def')).toEqual({ name: 'asset', id: 'abc def' });
  });
});

describe('Suchzustand aus der URL', () => {
  it('ignoriert Prototyp-Schlüssel', () => {
    const state = paramsToState(
      new URLSearchParams(
        'f.__proto__=a&f.constructor=b&d.__proto__=1900-01-01..&t.prototype=Contains:x&f.ok=1',
      ),
    );
    expect(Object.keys(state.facets)).toEqual(['ok']);
    expect(state.dates).toEqual({});
    expect(state.texts).toEqual({});
    expect(({} as Record<string, unknown>).a).toBeUndefined();
  });
});
