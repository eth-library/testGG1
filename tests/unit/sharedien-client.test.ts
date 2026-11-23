import { beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveConfig } from '../../src/config/load-config.ts';
import { SharedienClient } from '../../src/data/sharedien/client.ts';
import { createMockFetch } from '../../src/data/mock/mock-fetch.ts';
import { emptySearchState } from '../../src/state/search-state.ts';

/** Integrationstest: echter Client gegen die In-Process-Nachbildung der Sharedien-API. */
describe('SharedienClient (gegen Demo-Mock)', () => {
  const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'public/config/config.example.json'), 'utf8'));
  const config = resolveConfig({ ...raw, api: { ...raw.api, baseUrl: 'https://dam.example.org' } });
  const client = new SharedienClient(config, { fetch: createMockFetch({ delay: 0 }) });
  const log = () => window.__epMock!.log;

  beforeAll(async () => {
    await client.init('de');
  });

  it('lädt Felddefinitionen, Gruppen und Relationstypen', () => {
    const fields = client.fieldDefinitions();
    expect(fields.get('ba_photographer')).toMatchObject({ label: 'Fotograf/in', type: 'list' });
    expect(fields.get('ba_date')?.type).toBe('date');
    expect(fields.get('ba_photographer')?.options.get('ph_amsler')).toBe('Amsler, Clara');
    expect(client.relationTypes().get('rel_person')?.searchable).toBe(true);
  });

  it('sendet Standard-Header und Basis-URL', async () => {
    await client.search({ state: emptySearchState(), pageSize: 10, facetSources: [] });
    const entry = log().at(-1)!;
    expect(entry.method).toBe('POST');
    expect(entry.path).toBe('assets/search');
    expect(entry.query).toMatchObject({ langFallback: 'true', limit: '10' });
  });

  it('sucht mit Facetten und blättert per Cursor', async () => {
    const first = await client.search({
      state: { ...emptySearchState(), q: 'Zürich' },
      pageSize: 5,
      facetSources: ['ba_photographer'],
    });
    expect(first.total).toBeGreaterThan(5);
    expect(first.items).toHaveLength(5);
    expect(first.items[0].title).toMatch(/Zürich/);
    expect(first.items[0].width).toBeGreaterThan(0);
    expect(first.facets?.ba_photographer.size).toBeGreaterThan(0);
    const second = await client.search({
      state: { ...emptySearchState(), q: 'Zürich' },
      pageSize: 5,
      cursor: first.cursor,
      facetSources: ['ba_photographer'],
    });
    expect(second.items[0].id).not.toBe(first.items[0].id);
    // Auf Folgeseiten werden keine Facetten angefordert.
    expect(
      (log().at(-1)!.body as { facetPropertyDefinitionIdentifiers: string[] })
        .facetPropertyDefinitionIdentifiers,
    ).toEqual([]);
  });

  it('filtert nach Facette, Relation und Kategorie', async () => {
    const all = await client.search({
      state: emptySearchState(),
      pageSize: 200,
      facetSources: ['rel_person'],
    });
    const person = [...all.facets!.rel_person.keys()][0];
    const byPerson = await client.search({
      state: { ...emptySearchState(), facets: { rel_person: [person] } },
      pageSize: 200,
      facetSources: [],
    });
    expect(byPerson.total).toBe(all.facets!.rel_person.get(person));
    const alps = await client.search({
      state: { ...emptySearchState(), category: 'cat_ansichten' },
      pageSize: 200,
      facetSources: [],
    });
    expect(alps.total).toBeGreaterThan(0);
    expect(alps.total).toBeLessThan(all.total);
  });

  it('lädt Details mit gruppierten Metadaten, Kategoriepfad und Formaten', async () => {
    const [first] = (await client.search({ state: emptySearchState(), pageSize: 1, facetSources: [] })).items;
    const detail = await client.getAsset(first.id);
    expect(detail.preview).toMatch(/^data:image\/svg/);
    expect(detail.groups.map((g) => g.id)).toEqual(['grp_main', 'grp_context', 'grp_rights', 'grp_tech']);
    expect(detail.groups.flatMap((g) => g.fields).some((f) => f.id === 'ba_coordinates')).toBe(false);
    expect(detail.categories[0].path).toContain(' / ');
    const formats = await client.getDownloadFormats(first.id);
    expect(formats.map((f) => f.id)).toEqual(
      expect.arrayContaining(['Original', 'Print', 'Screen', 'Square']),
    );
    expect(formats.find((f) => f.id === 'Square')?.onDemand).toBe(true);
    expect(formats.some((f) => f.id === 'Thumbnail')).toBe(false);
    expect(await client.getDownloadUrl(first.id, 'Print')).toMatch(/^data:/);
  });

  it('liefert Kategorien, Pfade und Vorschläge', async () => {
    const children = await client.getCategoryChildren('root');
    expect(children.map((c) => c.id)).toContain('cat_luftbilder');
    const path = await client.getCategoryPath('cat_alpen');
    expect(path.map((p) => p.id)).toEqual(['root', 'cat_ansichten', 'cat_alpen']);
    const suggestions = await client.suggest('Glet', emptySearchState());
    expect(suggestions.length).toBeGreaterThan(0);
    const persons = await client.relationOptions('rel_person', 'Person');
    expect(persons.length).toBeGreaterThan(3);
  });
});
