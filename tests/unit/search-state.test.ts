import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  emptySearchState,
  paramsToState,
  stateKey,
  stateToParams,
  type SearchState,
} from '../../src/state/search-state.ts';

describe('Suchzustand ⇄ URL', () => {
  const full: SearchState = {
    q: 'Zürich Bahnhof',
    mode: 'and',
    ai: true,
    facets: { ba_photographer: ['ph_amsler', 'ph_frey'], rel_person: ['p_graf'] },
    dates: { ba_date: { from: '1900-01-01', to: '1950-12-31' }, other: { to: '1920-01-01' } },
    texts: { ba_signature: { op: 'Contains', value: 'Ans_0' } },
    category: 'cat_alpen',
    geo: { north: 47.5, west: 7.1, south: 46.2, east: 9.8 },
    sort: 'ba_date_desc',
  };

  it('überträgt alle Teile verlustfrei (Round-Trip)', () => {
    const params = stateToParams(full);
    expect(paramsToState(params)).toEqual(full);
  });

  it('lässt Standardwerte weg', () => {
    const params = stateToParams(emptySearchState());
    expect(params.toString()).toBe('');
  });

  it('kodiert Facetten als wiederholte Parameter', () => {
    const params = stateToParams(full);
    expect(params.getAll('f.ba_photographer')).toEqual(['ph_amsler', 'ph_frey']);
    expect(params.get('d.ba_date')).toBe('1900-01-01..1950-12-31');
    expect(params.get('d.other')).toBe('..1920-01-01');
    expect(params.get('t.ba_signature')).toBe('Contains:Ans_0');
  });

  it('ignoriert ungültige Werte', () => {
    const state = paramsToState(
      new URLSearchParams('d.x=gestern..morgen&geo=1,2,abc,4&t.y=nur-text&mode=xor'),
    );
    expect(state.dates).toEqual({});
    expect(state.geo).toBeUndefined();
    expect(state.texts).toEqual({});
    expect(state.mode).toBe('or');
  });

  it('zählt aktive Filter ohne Suchbegriff', () => {
    expect(activeFilterCount(full)).toBe(3 + 2 + 1 + 1 + 1);
    expect(activeFilterCount(emptySearchState())).toBe(0);
  });

  it('liefert einen reihenfolgeunabhängigen Schlüssel', () => {
    const a = { ...emptySearchState(), facets: { x: ['1', '2'], y: ['3'] } };
    const b = { ...emptySearchState(), facets: { y: ['3'], x: ['2', '1'] } };
    expect(stateKey(a)).toBe(stateKey(b));
  });
});
