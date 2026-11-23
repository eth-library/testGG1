/**
 * In-Process-Nachbildung der genutzten Sharedien-Endpunkte für Demo-Modus und Tests.
 * Der echte `SharedienClient` erzeugt dabei unveränderte Requests – nur `fetch` ist ersetzt.
 */
import type {
  AdvancedFilter,
  RawAsset,
  RawDerivation,
  RawRelation,
  RelationFilter,
  SearchBody,
} from '../sharedien/types.ts';
import {
  assetProperties,
  buildAssets,
  CATEGORY_TREE,
  categoryIndex,
  categoryProperties,
  PERSONS,
  PROPERTY_DEFINITIONS,
  PROPERTY_GROUPS,
  rawCategory,
  RELATION_TYPES,
  type FixtureAsset,
} from './fixtures.ts';
import { placeholderSvg, svgDataUri } from './placeholder.ts';
import { createZip } from './zip.ts';

export interface MockLogEntry {
  method: string;
  path: string;
  query: Record<string, string>;
  body?: unknown;
}

declare global {
  interface Window {
    __epMock?: { log: MockLogEntry[] };
  }
}

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

interface Indexed {
  asset: FixtureAsset;
  props: Map<string, { ids: string[]; texts: string[] }>;
  text: string;
  ancestors: Set<string>;
}

const LIST_LABELS = new Map<string, string>();
for (const def of PROPERTY_DEFINITIONS) {
  for (const item of def.listItems ?? [])
    LIST_LABELS.set(item.identifier, String(item.value[0]?.value ?? ''));
}

export function createMockFetch(options: { delay?: number } = {}): typeof fetch {
  const assets = buildAssets();
  const categories = categoryIndex();
  const imageCache = new Map<string, string>();
  const onDemandJobs = new Map<string, number>();
  const log: MockLogEntry[] = [];
  if (typeof window !== 'undefined') window.__epMock = { log };

  const ancestorsOf = (id: string) => {
    const set = new Set<string>();
    let current: string | undefined = id;
    while (current) {
      set.add(current);
      current = categories.get(current)?.parent;
    }
    return set;
  };

  const indexed: Indexed[] = assets.map((asset) => {
    const props = new Map<string, { ids: string[]; texts: string[] }>();
    for (const p of assetProperties(asset)) {
      const ids = p.propertyValues.map((v) => v.propertyListItemIdentifier).filter((v): v is string => !!v);
      const texts = p.propertyValues.flatMap((v) => (v.propertyValue ?? []).map((x) => String(x.value)));
      props.set(p.propertyDefinitionIdentifier, {
        ids,
        texts: [...texts, ...ids.map((id) => LIST_LABELS.get(id) ?? '')],
      });
    }
    const text = normalize(
      [asset.title, asset.description, asset.signature, ...[...props.values()].flatMap((p) => p.texts)].join(
        ' ',
      ),
    );
    return { asset, props, text, ancestors: ancestorsOf(asset.category) };
  });
  const byId = new Map(indexed.map((entry) => [entry.asset.id, entry]));

  const image = (asset: FixtureAsset, size: number, grain = false) => {
    const key = `${asset.id}:${size}:${grain}`;
    let uri = imageCache.get(key);
    if (!uri) {
      uri = svgDataUri(
        placeholderSvg({
          id: asset.id,
          scene: asset.scene,
          width: asset.width,
          height: asset.height,
          size,
          grain,
        }),
      );
      imageCache.set(key, uri);
    }
    return uri;
  };

  const rawAsset = (entry: Indexed, include?: string[]): RawAsset => {
    const properties = assetProperties(entry.asset).filter(
      (p) => !include?.length || include.includes(p.propertyDefinitionIdentifier),
    );
    return {
      identifier: entry.asset.id,
      fileName: `${entry.asset.signature}.tif`,
      assetType: 'Image',
      entityTypeIdentifier: 'AssetSet',
      thumbnailUri: image(entry.asset, 520),
      created: '2024-08-22T08:00:00Z',
      properties,
    };
  };

  const derivations = (asset: FixtureAsset): RawDerivation[] => {
    const base = asset.signature;
    const px = asset.width * asset.height;
    return [
      {
        derivationTypeIdentifier: 'Thumbnail',
        uri: image(asset, 520),
        fileName: `${base}_thumb.jpg`,
        fileSize: 42_000,
        fileMimeType: 'image/jpeg',
      },
      {
        derivationTypeIdentifier: 'Screen',
        uri: image(asset, 1600, true),
        fileName: `${base}_web.jpg`,
        fileSize: Math.round(px * 0.06),
        fileMimeType: 'image/jpeg',
      },
      {
        derivationTypeIdentifier: 'Print',
        uri: image(asset, 2600, true),
        fileName: `${base}_print.jpg`,
        fileSize: Math.round(px * 0.5),
        fileMimeType: 'image/jpeg',
      },
      {
        derivationTypeIdentifier: 'Original',
        uri: image(asset, 2600, true),
        fileName: `${base}.tif`,
        fileSize: px * 3,
        fileMimeType: 'image/tiff',
        assetTypeIdentifier: 'Image',
      },
    ].map((d) => ({ ...d, downloadUri: d.uri }));
  };

  const matchesFilter = (entry: Indexed, filter: AdvancedFilter): boolean => {
    const prop = entry.props.get(filter.propertyDefinitionIdentifier);
    const texts = (prop?.texts ?? []).map(normalize);
    const q = (filter.q ?? []).map((v) => normalize(String(v)));
    switch (filter.op) {
      case 'IdentifierEquals':
        return q.some((v) => prop?.ids.map(normalize).includes(v) || texts.includes(v));
      case 'Contains':
      case 'FuzzyContains':
        return q.every((v) => texts.some((t) => t.includes(v)));
      case 'DoesNotContain':
        return q.every((v) => !texts.some((t) => t.includes(v)));
      case 'Equals':
      case 'FuzzyEquals':
        return q.some((v) => texts.some((t) => t === v || t.startsWith(v)));
      case 'NotEquals':
        return q.every((v) => !texts.includes(v));
      case 'GreaterThanOrEquals':
        return texts.some((t) => t >= q[0]);
      case 'LessThanOrEquals':
        return texts.some((t) => t <= q[0].slice(0, 10));
      case 'Between':
        return texts.some((t) => t >= q[0].slice(0, 10) && t <= q[1].slice(0, 10));
      case 'InBoundingBox': {
        const [n, w] = (filter.q?.[0] ?? '').split(',').map(Number);
        const [s, e] = (filter.q?.[1] ?? '').split(',').map(Number);
        const [lat, lng] = entry.asset.coordinates;
        return lat <= n && lat >= s && lng >= w && lng <= e;
      }
      case 'HasValue':
        return texts.length > 0;
      case 'HasNoValue':
        return texts.length === 0;
      default:
        return true;
    }
  };

  const search = (body: SearchBody) => {
    let result = indexed;
    if (body.categories?.length)
      result = result.filter((e) => body.categories.some((c) => e.ancestors.has(c)));
    if (body.q) {
      const q = normalize(body.q);
      if (body.exactSearch) result = result.filter((e) => e.text.includes(q));
      else {
        const words = q.split(/\s+/).filter(Boolean);
        const hit = (e: Indexed, w: string) =>
          e.text.includes(body.semanticSearch ? w.slice(0, Math.max(3, w.length - 2)) : w);
        result = result.filter((e) =>
          body.operator === 'And' ? words.every((w) => hit(e, w)) : words.some((w) => hit(e, w)),
        );
      }
    }
    // Gleiche Felder mit IdentifierEquals werden ODER-verknüpft, alles andere UND.
    const groups = new Map<string, AdvancedFilter[]>();
    for (const filter of body.advancedSearchFilters ?? []) {
      const key =
        filter.op === 'IdentifierEquals'
          ? `${filter.propertyDefinitionIdentifier}|eq`
          : `${groups.size}|${Math.random()}`;
      groups.set(key, [...(groups.get(key) ?? []), filter]);
    }
    for (const group of groups.values())
      result = result.filter((e) => group.some((f) => matchesFilter(e, f)));
    const relationGroups = new Map<string, RelationFilter[]>();
    for (const rel of body.relationFilters ?? []) {
      relationGroups.set(rel.relationTypeIdentifier, [
        ...(relationGroups.get(rel.relationTypeIdentifier) ?? []),
        rel,
      ]);
    }
    for (const group of relationGroups.values()) {
      result = result.filter((e) =>
        group.some((rel) => rel.entityIdentifier && e.asset.persons.includes(rel.entityIdentifier)),
      );
    }
    if (body.sort?.length) {
      const { propertyDefinitionIdentifier: prop, direction } = body.sort[0];
      const value = (e: Indexed) => normalize(e.props.get(prop)?.texts[0] ?? '');
      result = [...result].sort((a, b) => value(a).localeCompare(value(b)) * (direction === 'Desc' ? -1 : 1));
    } else if (body.q) {
      const q = normalize(body.q);
      result = [...result].sort(
        (a, b) => Number(normalize(b.asset.title).includes(q)) - Number(normalize(a.asset.title).includes(q)),
      );
    }
    const facets = (body.facetPropertyDefinitionIdentifiers ?? []).map((source) => {
      const counts = new Map<string, number>();
      for (const entry of result) {
        const ids = source === 'rel_person' ? entry.asset.persons : (entry.props.get(source)?.ids ?? []);
        for (const id of new Set(ids)) counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      return {
        propertyDefinitionIdentifier: source,
        items: [...counts].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count),
      };
    });
    return { result, facets };
  };

  const categoryThumb = (id: string) => {
    const entry = indexed.find((e) => e.ancestors.has(id));
    return entry ? image(entry.asset, 640) : undefined;
  };

  const pathOf = (id: string) => {
    const chain: string[] = [];
    let current: string | undefined = id;
    while (current) {
      chain.unshift(current);
      current = categories.get(current)?.parent;
    }
    return chain.map((cid) => {
      const spec = categories.get(cid)!.spec;
      return { entity: { identifier: cid }, name: rawCategory(spec).name };
    });
  };

  const json = (data: unknown, init: { status?: number; headers?: Record<string, string> } = {}) =>
    new Response(JSON.stringify(data), {
      status: init.status ?? 200,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  const notFound = () => json({ title: 'Not Found' }, { status: 404 });

  const handle = (method: string, path: string, query: URLSearchParams, body: unknown): Response => {
    const segments = path.split('/').map(decodeURIComponent);
    const [resource, id, sub, subId] = segments;

    if (resource === 'property-definitions') return json(PROPERTY_DEFINITIONS);
    if (resource === 'property-groups') return json(PROPERTY_GROUPS);
    if (resource === 'relation-types') return json(RELATION_TYPES);
    if (resource === 'application-settings')
      return json({ sharedien: { similarSearch: { isEnabled: true } } });

    if (resource === 'assets' && id === 'search' && method === 'POST') {
      const request = body as SearchBody;
      const { result, facets } = search(request);
      const limit = Number(query.get('limit') ?? 50);
      const offset = Number(query.get('cursor') ?? 0);
      const page = result.slice(offset, offset + limit);
      const next = offset + limit < result.length ? String(offset + limit) : null;
      return json(
        {
          items: page.map((e) => rawAsset(e, request.includePropertyDefinitionIdentifiers)),
          cursor: next,
          facets: offset === 0 ? facets : [],
        },
        { headers: { 'x-total-count': String(result.length) } },
      );
    }

    if (resource === 'assets' && id === 'quicksearch') {
      const request = body as SearchBody;
      const q = normalize(request.q ?? '');
      const words = new Map<string, number>();
      for (const entry of search({ ...request, q: '' }).result) {
        for (const word of entry.text.split(/[^a-z0-9äöüéèà-]+/)) {
          if (word.length > 3 && word.startsWith(q)) words.set(word, (words.get(word) ?? 0) + 1);
        }
        const title = normalize(entry.asset.title);
        if (title.includes(q)) words.set(entry.asset.title, (words.get(entry.asset.title) ?? 0) + 3);
      }
      const suggestions = [...words]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([w]) => w);
      return json({ autoCompleteSuggestions: suggestions });
    }

    if (resource === 'assets' && id === 'stream-formdata' && method === 'POST') {
      const form = body as FormData;
      const request = JSON.parse(String(form.get('zipDownloadRequest') ?? '{"assets":[]}')) as {
        assets: Array<{ identifier: string; derivationTypeIdentifier: string }>;
      };
      const lines = request.assets.map((a) => {
        const entry = byId.get(a.identifier);
        return `${entry?.asset.signature ?? a.identifier}\t${a.derivationTypeIdentifier}\t${entry?.asset.title ?? ''}`;
      });
      const files = [
        { name: 'LIESMICH.txt', data: `Demo-ZIP des Bildkatalogs\n\n${lines.join('\n')}\n` },
        ...request.assets.flatMap((a) => {
          const entry = byId.get(a.identifier);
          if (!entry) return [];
          const svg = placeholderSvg({
            id: entry.asset.id,
            scene: entry.asset.scene,
            width: entry.asset.width,
            height: entry.asset.height,
            size: 1600,
          });
          return [{ name: `${entry.asset.signature}_${a.derivationTypeIdentifier}.svg`, data: svg }];
        }),
      ];
      return new Response(createZip(files), {
        headers: {
          'content-type': 'application/zip',
          'content-disposition': 'attachment; filename="bildarchiv-auswahl.zip"',
        },
      });
    }

    if (resource === 'assets' && id) {
      const entry = byId.get(id);
      if (!entry) return notFound();
      if (!sub) return json(rawAsset(entry));
      if (sub === 'properties') return json(assetProperties(entry.asset));
      if (sub === 'derivation-types') {
        return json([
          {
            identifier: 'Thumbnail',
            name: [{ value: 'Vorschaubild' }],
            assetTypeSettings: [{ useAsThumbnail: true }],
          },
          {
            identifier: 'Screen',
            name: [{ value: 'Web (JPEG)' }],
            assetTypeSettings: [{ useAsPreview: true }],
          },
          { identifier: 'Print', name: [{ value: 'Druck (JPEG, 300 dpi)' }], assetTypeSettings: [{}] },
          { identifier: 'Original', name: [{ value: 'Original (TIFF)' }], assetTypeSettings: [{}] },
          {
            identifier: 'Square',
            name: [{ value: 'Quadratisch (Social Media)' }],
            assetTypeSettings: [{ isOnDemand: true }],
          },
        ]);
      }
      if (sub === 'derivations' && !subId) return json(derivations(entry.asset));
      if (sub === 'derivations' && subId) {
        const existing = derivations(entry.asset).find((d) => d.derivationTypeIdentifier === subId);
        if (existing) return json(existing);
        const key = `${id}:${subId}`;
        if (method === 'POST') {
          onDemandJobs.set(key, 0);
          return json({ identifier: `job-${key}` });
        }
        if (!onDemandJobs.has(key)) return notFound();
        const polls = (onDemandJobs.get(key) ?? 0) + 1;
        onDemandJobs.set(key, polls);
        const uri = image(entry.asset, 1600);
        return json({
          derivationTypeIdentifier: subId,
          status: polls >= 2 ? 'Finished' : 'InProgress',
          downloadUri: polls >= 2 ? uri : undefined,
        });
      }
      if (sub === 'relations' && subId === 'search') {
        const request = body as {
          includeRelationTypeIdentifiers?: string[];
          includePropertyDefinitionIdentifiers?: string[];
        };
        const types = request.includeRelationTypeIdentifiers ?? [];
        const relations: RawRelation[] = [];
        const self = { ...rawAsset(entry), entityTypeIdentifier: 'AssetSet' };
        if (types.includes('ParentChild')) {
          relations.push({
            relationTypeIdentifier: 'ParentChild',
            fromEntity: { identifier: entry.asset.category, entityTypeIdentifier: 'Category', name: [] },
            toEntity: self,
            pathSegments: pathOf(entry.asset.category),
          });
        }
        if (types.includes('rel_series')) {
          indexed
            .filter((e) => e.asset.category === entry.asset.category && e.asset.id !== id)
            .slice(0, 10)
            .forEach((other) =>
              relations.push({
                relationTypeIdentifier: 'rel_series',
                fromEntity: self,
                toEntity: {
                  ...rawAsset(other, request.includePropertyDefinitionIdentifiers),
                  entityTypeIdentifier: 'AssetSet',
                },
              }),
            );
        }
        return json(relations, { headers: { 'x-total-count': String(relations.length) } });
      }
      return notFound();
    }

    if (resource === 'categories') {
      if (id === 'quicksearch') {
        const q = normalize((body as { q?: string }).q ?? '');
        const items = [...categories.values()]
          .filter(
            ({ spec }) =>
              spec.id !== 'root' && (normalize(spec.de).includes(q) || normalize(spec.en).includes(q)),
          )
          .map(({ spec }) => rawCategory(spec, categoryThumb(spec.id)));
        return json({ items });
      }
      if (id === 'search') {
        const ids = (body as { categories?: string[] }).categories ?? [];
        return json({
          items: ids
            .map((cid) => categories.get(cid))
            .filter(Boolean)
            .map((c) => rawCategory(c!.spec)),
        });
      }
      const node = categories.get(id ?? CATEGORY_TREE.id);
      if (!node) return notFound();
      if (!sub) return json(rawCategory(node.spec, categoryThumb(node.spec.id)));
      if (sub === 'children') {
        const children = (node.spec.children ?? []).map((c) => rawCategory(c, categoryThumb(c.id)));
        const offset = Number(query.get('offset') ?? 0);
        const limit = Number(query.get('limit') ?? 500);
        return json(children.slice(offset, offset + limit), {
          headers: { 'x-total-count': String(children.length) },
        });
      }
      if (sub === 'path') return json(pathOf(node.spec.id));
      if (sub === 'properties') return json(categoryProperties(node.spec));
      return notFound();
    }

    if (resource === 'custom-entities' && id === 'search') {
      const request = body as { advancedSearchFilters?: AdvancedFilter[] };
      const filter = normalize(request.advancedSearchFilters?.[0]?.q?.[0] ?? '');
      const items = PERSONS.filter(([, name]) => !filter || normalize(name).includes(filter)).map(
        ([identifier, name]) => ({
          identifier,
          entityTypeIdentifier: 'Person',
          name: [{ value: name }],
        }),
      );
      return json({ items }, { headers: { 'x-total-count': String(items.length) } });
    }

    return notFound();
  };

  const delay = options.delay ?? 160;

  return async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      location.origin,
    );
    const method = (init.method ?? 'GET').toUpperCase();
    const match = url.pathname.match(/\/api\/v\d+\/(.*)$/);
    if (!match) return new Response('Not found', { status: 404 });
    let body: unknown;
    if (init.body instanceof FormData) body = init.body;
    else if (typeof init.body === 'string') body = JSON.parse(init.body);
    const query = Object.fromEntries(url.searchParams);
    log.push({
      method,
      path: match[1],
      query,
      body: body instanceof FormData ? Object.fromEntries(body) : body,
    });
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay * (0.6 + Math.random() * 0.8)));
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return handle(method, match[1].replace(/\/+$/, ''), url.searchParams, body);
  };
}
