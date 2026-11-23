import { describe, expect, it } from 'vitest';
import { buildSearchBody, parseSort, type QueryContext } from '../../src/data/sharedien/query-builder.ts';
import { emptySearchState } from '../../src/state/search-state.ts';
import type { FieldDefinition } from '../../src/data/model.ts';

const field = (id: string, patch: Partial<FieldDefinition> = {}): [string, FieldDefinition] => [
  id,
  {
    id,
    label: id,
    type: 'text',
    isList: false,
    translatable: false,
    searchable: true,
    order: 0,
    options: new Map(),
    ...patch,
  },
];

const ctx = (patch: Partial<QueryContext> = {}): QueryContext => ({
  locale: 'de',
  filters: [
    { type: 'facet', source: 'ba_photographer' },
    { type: 'relation', source: 'rel_person', valueType: 'Person' },
  ],
  fixedFilters: [],
  fields: new Map([
    field('ba_title', { translatable: true }),
    field('ba_date', { type: 'date' }),
    field('created', { type: 'datetime' }),
    field('ba_photographer', { type: 'list' }),
  ]),
  relations: new Map(),
  coordinatesField: 'ba_coordinates',
  recursive: true,
  include: ['ba_title', 'ba_title', 'ba_date'],
  facetSources: ['ba_photographer', 'rel_person'],
  ...patch,
});

describe('Sharedien-Query-Builder', () => {
  it('erzeugt einen leeren Grundkörper', () => {
    const body = buildSearchBody(emptySearchState(), ctx());
    expect(body).toEqual({
      categories: [],
      advancedSearchFilters: [],
      relationFilters: [],
      facetPropertyDefinitionIdentifiers: ['ba_photographer', 'rel_person'],
      includePropertyDefinitionIdentifiers: ['ba_title', 'ba_date'],
      recursivelyFilterCategories: true,
    });
  });

  it('übersetzt Volltext, Phrase, UND und KI-Suche', () => {
    expect(buildSearchBody({ ...emptySearchState(), q: '  Zürich  ' }, ctx())).toMatchObject({ q: 'Zürich' });
    const phrase = buildSearchBody({ ...emptySearchState(), q: '"Hotel Rigi"' }, ctx());
    expect(phrase).toMatchObject({ q: 'Hotel Rigi', exactSearch: true });
    const and = buildSearchBody({ ...emptySearchState(), q: 'a b', mode: 'and', ai: true }, ctx());
    expect(and).toMatchObject({ operator: 'And', semanticSearch: true });
    expect(buildSearchBody({ ...emptySearchState(), mode: 'and' }, ctx()).operator).toBeUndefined();
  });

  it('erzeugt je Facettenwert einen IdentifierEquals-Filter', () => {
    const body = buildSearchBody({ ...emptySearchState(), facets: { ba_photographer: ['a', 'b'] } }, ctx());
    expect(body.advancedSearchFilters).toEqual([
      { op: 'IdentifierEquals', propertyDefinitionIdentifier: 'ba_photographer', q: ['a'] },
      { op: 'IdentifierEquals', propertyDefinitionIdentifier: 'ba_photographer', q: ['b'] },
    ]);
  });

  it('erzeugt Relationsfilter mit Entitätstyp', () => {
    const body = buildSearchBody({ ...emptySearchState(), facets: { rel_person: ['p1'] } }, ctx());
    expect(body.relationFilters).toEqual([
      {
        operator: 'HasRelation',
        relationTypeIdentifier: 'rel_person',
        entityIdentifier: 'p1',
        entityTypeIdentifier: 'Person',
      },
    ]);
    expect(body.advancedSearchFilters).toEqual([]);
  });

  it('wählt den passenden Datumsoperator', () => {
    const op = (from?: string, to?: string, source = 'ba_date') =>
      buildSearchBody({ ...emptySearchState(), dates: { [source]: { from, to } } }, ctx())
        .advancedSearchFilters[0];
    expect(op('1900-01-01', '1950-12-31')).toEqual({
      op: 'Between',
      propertyDefinitionIdentifier: 'ba_date',
      q: ['1900-01-01', '1950-12-31'],
    });
    expect(op('1900-05-01', '1900-05-01')?.op).toBe('Equals');
    expect(op('1900-01-01')).toMatchObject({ op: 'GreaterThanOrEquals', q: ['1900-01-01'] });
    expect(op(undefined, '1910-01-01')).toMatchObject({ op: 'LessThanOrEquals', q: ['1910-01-01'] });
    expect(op('2000-01-01', '2000-01-02', 'created')).toMatchObject({
      op: 'Between',
      q: ['2000-01-01T00:00:00.000Z', '2000-01-02T23:59:59.999Z'],
    });
  });

  it('setzt bei übersetzbaren Textfeldern die Sprache', () => {
    const body = buildSearchBody(
      {
        ...emptySearchState(),
        texts: { ba_title: { op: 'DoesNotContain', value: ' Bahn ' }, x: { op: 'Contains', value: ' ' } },
      },
      ctx(),
    );
    expect(body.advancedSearchFilters).toEqual([
      { op: 'DoesNotContain', propertyDefinitionIdentifier: 'ba_title', q: ['Bahn'], languages: ['de'] },
    ]);
  });

  it('übersetzt Kategorie, Kartenausschnitt und feste Filter', () => {
    const body = buildSearchBody(
      { ...emptySearchState(), category: 'cat_1', geo: { north: 47.8, west: 5.9, south: 45.8, east: 10.5 } },
      ctx({
        fixedFilters: [
          { source: 'categories', value: 'cat_fix' },
          { source: 'ba_public', op: 'HasValue' },
          { source: 'ba_status', value: 'published' },
        ],
      }),
    );
    expect(body.categories).toEqual(['cat_1', 'cat_fix']);
    expect(body.advancedSearchFilters).toEqual([
      { op: 'InBoundingBox', propertyDefinitionIdentifier: 'ba_coordinates', q: ['47.8,5.9', '45.8,10.5'] },
      { op: 'HasValue', propertyDefinitionIdentifier: 'ba_public' },
      { op: 'IdentifierEquals', propertyDefinitionIdentifier: 'ba_status', q: ['published'] },
    ]);
  });

  it('sortiert mit Sprache nur bei übersetzbaren Feldern', () => {
    expect(buildSearchBody({ ...emptySearchState(), sort: 'ba_title_asc' }, ctx()).sort).toEqual([
      { propertyDefinitionIdentifier: 'ba_title', languageIdentifier: 'de', direction: 'Asc' },
    ]);
    expect(buildSearchBody({ ...emptySearchState(), sort: 'ba_date_desc' }, ctx()).sort).toEqual([
      { propertyDefinitionIdentifier: 'ba_date', languageIdentifier: null, direction: 'Desc' },
    ]);
    expect(buildSearchBody(emptySearchState(), ctx()).sort).toBeUndefined();
  });

  it('zerlegt Sortierschlüssel', () => {
    expect(parseSort('relevance')).toBeNull();
    expect(parseSort('ba_date_desc')).toEqual({ field: 'ba_date', direction: 'desc' });
    expect(parseSort('file_name')).toEqual({ field: 'file_name', direction: 'asc' });
  });
});
