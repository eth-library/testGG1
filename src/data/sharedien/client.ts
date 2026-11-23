import type { AppConfig } from '../../config/schema.ts';
import type { SearchState } from '../../state/search-state.ts';
import type {
  Asset,
  AssetDetail,
  CatalogAdapter,
  CategoryInfo,
  CategoryNode,
  DownloadFormat,
  FacetCounts,
  FacetOption,
  FieldDefinition,
  FieldType,
  RelationType,
  SearchPage,
  SearchRequest,
  ZipItem,
} from '../model.ts';
import {
  entityId,
  entityPath,
  mapAsset,
  mapCategory,
  mapFieldDefinition,
  mapGroup,
  mapMetadataGroups,
  mapProperties,
  mapRelationType,
  mediaTypeOf,
  resolveName,
  thumbnailOf,
  type MapContext,
} from './mappers.ts';
import { buildSearchBody } from './query-builder.ts';
import type {
  RawAsset,
  RawCategory,
  RawDerivation,
  RawDerivationType,
  RawPathItem,
  RawProperty,
  RawPropertyDefinition,
  RawPropertyGroup,
  RawRelation,
  RawRelationType,
  RawSearchResponse,
} from './types.ts';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export interface ClientOptions {
  fetch?: typeof fetch;
  formatDate?: (iso: string, type: FieldType) => string;
  formatBytes?: (bytes: number) => string;
}

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
};

const PREVIEW_ROLES = (type: RawDerivationType) =>
  type.assetTypeSettings?.some((s) => s.useAsPreview || s.useAsThumbnail) ?? false;

/**
 * Client für die Sharedien REST API (v13) – eigene Implementierung auf Basis der API-Dokumentation.
 * Der Browser spricht direkt mit Sharedien; der (öffentliche) Gast-Token stammt aus der Config.
 */
export class SharedienClient implements CatalogAdapter {
  readonly #config: AppConfig;
  readonly #fetch: typeof fetch;
  readonly #base: string;
  #token?: string;
  #tokenPromise?: Promise<string | undefined>;
  #locale = 'de';
  #rawDefinitions: RawPropertyDefinition[] = [];
  #rawGroups: RawPropertyGroup[] = [];
  #rawRelations: RawRelationType[] = [];
  #fields = new Map<string, FieldDefinition>();
  #groups = new Map<string, { id: string; label: string; order: number }>();
  #relations = new Map<string, RelationType>();
  #inflight = new Map<string, Promise<unknown>>();
  #detailCache = new Map<string, AssetDetail>();
  #listCache = new Map<string, Asset>();
  #relationOptionsCache = new Map<string, Promise<FacetOption[]>>();
  #aiEnabled?: Promise<boolean>;
  readonly #formatDate: (iso: string, type: FieldType) => string;
  readonly #formatBytes: (bytes: number) => string;

  constructor(config: AppConfig, options: ClientOptions = {}) {
    this.#config = config;
    this.#fetch = options.fetch ?? window.fetch.bind(window);
    const base = config.api.baseUrl.replace(/\/+$/, '');
    this.#base = `${base}/api/${config.api.version}`;
    this.#token = config.api.token;
    this.#formatDate = options.formatDate ?? ((iso) => iso);
    this.#formatBytes = options.formatBytes ?? ((bytes) => `${Math.round(bytes / 1024)} kB`);
  }

  get baseUrl(): string {
    return this.#base;
  }

  // ---------------------------------------------------------------------------------------------
  // Grundlagen

  async init(locale: string): Promise<void> {
    this.#locale = locale;
    const [definitions, groups, relations] = await Promise.all([
      this.#json<RawPropertyDefinition[]>('property-definitions', {
        query: { langFallback: true, includeListItems: true, limit: 10000, statusFilter: 'Active' },
      }),
      this.#json<RawPropertyGroup[]>('property-groups', {
        query: { langFallback: true, statusFilter: 'Active', limit: 10000 },
      }),
      this.#json<RawRelationType[]>('relation-types', {
        query: { statusFilter: 'active', langFallback: true },
      }).catch(() => [] as RawRelationType[]),
    ]);
    this.#rawDefinitions = toArray(definitions);
    this.#rawGroups = toArray(groups);
    this.#rawRelations = toArray(relations);
    this.#translateDefinitions();
  }

  async setLocale(locale: string): Promise<void> {
    if (locale === this.#locale) return;
    this.#locale = locale;
    this.#detailCache.clear();
    this.#listCache.clear();
    this.#relationOptionsCache.clear();
    // Feldnamen sind in allen Sprachen geladen (langFallback) – neu übersetzen genügt.
    this.#translateDefinitions();
  }

  fieldDefinitions(): Map<string, FieldDefinition> {
    return this.#fields;
  }

  relationTypes(): Map<string, RelationType> {
    return this.#relations;
  }

  #translateDefinitions(): void {
    const fallback = this.#config.locales.dataFallback;
    this.#fields = new Map(
      this.#rawDefinitions.map((d) => [d.identifier, mapFieldDefinition(d, this.#locale, fallback)]),
    );
    this.#groups = new Map(this.#rawGroups.map((g) => [g.identifier, mapGroup(g, this.#locale, fallback)]));
    this.#relations = new Map(
      this.#rawRelations
        .map((r) => mapRelationType(r, this.#locale, fallback))
        .sort((a, b) => a.order - b.order)
        .map((r) => [r.id, r]),
    );
  }

  #mapContext(): MapContext {
    const { fields, download, detail, locales } = this.#config;
    return {
      locale: this.#locale,
      fallbackLocale: locales.dataFallback,
      fields: this.#fields,
      groups: this.#groups,
      hidden: new Set(detail.hiddenFields),
      config: {
        title: fields.title,
        date: fields.date,
        width: fields.width,
        height: fields.height,
        coordinates: fields.coordinates,
        restriction: download.restriction,
      },
      formatDate: this.#formatDate,
      formatBytes: this.#formatBytes,
    };
  }

  /** Felder, die für Karten, Tabelle und Export in Trefferlisten benötigt werden. */
  #listFields(extra: string[] = []): string[] {
    const { fields, results, download } = this.#config;
    return [
      'file_name',
      ...[
        fields.title,
        fields.date,
        fields.creator,
        fields.width,
        fields.height,
        fields.license,
        fields.coordinates,
      ],
      ...results.tableColumns.map((c) => c.field),
      download.restriction?.field,
      ...extra,
    ].filter((f): f is string => !!f);
  }

  // ---------------------------------------------------------------------------------------------
  // HTTP

  async #getToken(force = false): Promise<string | undefined> {
    const { tokenUrl } = this.#config.api;
    if (!tokenUrl) return this.#token;
    if (this.#token && !force) return this.#token;
    this.#tokenPromise ??= this.#fetch(tokenUrl, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new ApiError(response.status, 'Token konnte nicht geladen werden');
        const json = (await response.json()) as { access_token?: string; token?: string };
        this.#token = json.access_token ?? json.token;
        return this.#token;
      })
      .finally(() => (this.#tokenPromise = undefined));
    return this.#tokenPromise;
  }

  #headers(token: string | undefined, withBody: boolean): HeadersInit {
    const fallback = this.#config.locales.dataFallback;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Data-Languages':
        fallback && fallback !== this.#locale ? `${this.#locale},${fallback}` : this.#locale,
    };
    if (withBody) headers['Content-Type'] = 'application/json-patch+json';
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  #url(path: string, query: RequestOptions['query'] = {}): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    if (this.#config.api.browserIdentifier && !params.has('browserIdentifier') && /search/.test(path)) {
      params.set('browserIdentifier', this.#config.api.browserIdentifier);
    }
    const qs = params.toString();
    return `${this.#base}/${path}${qs ? `?${qs}` : ''}`;
  }

  async #request(path: string, options: RequestOptions = {}, attempt = 0): Promise<Response> {
    const method = options.method ?? (options.body !== undefined ? 'POST' : 'GET');
    const token = await this.#getToken(attempt > 0);
    let response: Response;
    try {
      response = await this.#fetch(this.#url(path, options.query), {
        method,
        headers: this.#headers(token, options.body !== undefined),
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: options.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      if (attempt === 0 && method === 'GET') return this.#request(path, options, 1);
      throw new ApiError(0, `Netzwerkfehler: ${(error as Error).message}`);
    }
    if (response.status === 401 && attempt === 0 && this.#config.api.tokenUrl) {
      return this.#request(path, options, 1);
    }
    if (response.status >= 500 && attempt === 0 && method === 'GET') return this.#request(path, options, 1);
    if (!response.ok) throw new ApiError(response.status, `${method} ${path} → ${response.status}`);
    return response;
  }

  /** JSON laden; identische, gleichzeitige GET-Anfragen werden zusammengelegt. */
  async #json<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const key =
      options.body === undefined && !options.signal ? `${path}?${JSON.stringify(options.query ?? {})}` : '';
    if (key && this.#inflight.has(key)) return this.#inflight.get(key) as Promise<T>;
    const promise = this.#request(path, options)
      .then((response) => (response.status === 204 ? (null as T) : (response.json() as Promise<T>)))
      .finally(() => key && this.#inflight.delete(key));
    if (key) this.#inflight.set(key, promise);
    return promise;
  }

  // ---------------------------------------------------------------------------------------------
  // Suche

  async search(request: SearchRequest, signal?: AbortSignal): Promise<SearchPage> {
    const body = buildSearchBody(request.state, {
      locale: this.#locale,
      filters: this.#config.filters,
      fixedFilters: this.#config.catalog.fixedFilters,
      fields: this.#fields,
      relations: this.#relations,
      coordinatesField: this.#config.fields.coordinates,
      recursive: this.#config.catalog.recursiveCategories,
      include: this.#listFields(request.fields),
      facetSources: request.cursor ? [] : request.facetSources,
    });
    const response = await this.#request('assets/search', {
      body,
      query: { langFallback: true, limit: request.pageSize, cursor: request.cursor },
      signal,
    });
    const total = Number.parseInt(response.headers.get('x-total-count') ?? '', 10) || 0;
    const json = (await response.json()) as RawSearchResponse;
    const ctx = this.#mapContext();
    const items = (json.items ?? []).map((raw) => mapAsset(raw, ctx));
    for (const item of items) this.#listCache.set(item.id, item);
    let facets: FacetCounts | undefined;
    if (json.facets) {
      facets = {};
      for (const facet of json.facets) {
        facets[facet.propertyDefinitionIdentifier] = new Map(facet.items.map((i) => [i.term, i.count]));
      }
    }
    return { items, total, cursor: json.cursor ?? undefined, facets };
  }

  async suggest(text: string, state: SearchState, signal?: AbortSignal): Promise<string[]> {
    if (!this.#config.search.suggestions || text.trim().length < 2) return [];
    const body = buildSearchBody(
      { ...state, q: text },
      {
        locale: this.#locale,
        filters: this.#config.filters,
        fixedFilters: this.#config.catalog.fixedFilters,
        fields: this.#fields,
        relations: this.#relations,
        coordinatesField: this.#config.fields.coordinates,
        recursive: this.#config.catalog.recursiveCategories,
        include: [],
        facetSources: [],
      },
    );
    const json = await this.#json<{ autoCompleteSuggestions?: string[] }>('assets/quicksearch', {
      body,
      query: {
        includeQuickSearch: false,
        includeSuggestions: true,
        langFallback: true,
        limit: 10,
        offset: 0,
      },
      signal,
    });
    return [
      ...new Set(
        (json?.autoCompleteSuggestions ?? [])
          .map((s) =>
            s
              .replace(/[{}[\]]/g, '')
              .replace(/\s+/g, ' ')
              .trim(),
          )
          .filter(Boolean),
      ),
    ];
  }

  isAiSearchEnabled(): Promise<boolean> {
    if (this.#config.search.aiSearch === 'off') return Promise.resolve(false);
    this.#aiEnabled ??= this.#json<{ sharedien?: { similarSearch?: { isEnabled?: boolean } } }>(
      'application-settings/frontend',
    )
      .then((json) => !!json?.sharedien?.similarSearch?.isEnabled)
      .catch(() => false);
    return this.#aiEnabled;
  }

  // ---------------------------------------------------------------------------------------------
  // Einzelnes Asset

  async getAsset(id: string): Promise<AssetDetail> {
    const cached = this.#detailCache.get(id);
    if (cached) return cached;
    const path = entityPath(id);
    const [raw, properties, derivations] = await Promise.all([
      this.#json<RawAsset>(path, { query: { langFallback: true } }),
      this.#json<RawProperty[]>(`${path}/properties`, { query: { langFallback: true } }),
      id.includes('_')
        ? Promise.resolve([] as RawDerivation[])
        : this.#json<RawDerivation[]>(`${path}/derivations`).catch(() => [] as RawDerivation[]),
    ]);
    if (!raw?.identifier) throw new ApiError(404, 'Asset nicht gefunden');
    const ctx = this.#mapContext();
    const base = mapAsset({ ...raw, properties: toArray(properties) }, ctx);
    const list = toArray(derivations);
    const find = (type: string) => list.find((d) => d.derivationTypeIdentifier === type);
    const original = find('Original');
    let preview = find(this.#config.download.previewFormat) ?? find('Screen');
    if (!preview && original && /movie|video|pdf|audio/i.test(original.assetTypeIdentifier ?? ''))
      preview = original;
    const categories = await this.#categoryPaths(id).catch(() => []);
    const detail: AssetDetail = {
      ...base,
      fileName: raw.fileName,
      preview: preview?.uri ?? preview?.downloadUri ?? base.thumbnail,
      previewMime: preview?.fileMimeType,
      mediaType: mediaTypeOf(raw.assetType ?? original?.assetTypeIdentifier, preview?.fileMimeType),
      groups: mapMetadataGroups(toArray(properties), ctx),
      categories,
    };
    this.#detailCache.set(id, detail);
    if (this.#detailCache.size > 120) this.#detailCache.delete(this.#detailCache.keys().next().value!);
    return detail;
  }

  async getAssets(ids: string[]): Promise<Asset[]> {
    const missing = ids.filter((id) => !this.#listCache.has(id));
    // Fehlende Assets in Paketen über die Suche nach Identifier laden wäre effizienter;
    // die API bietet dafür keinen dokumentierten Filter – daher Einzelabruf (parallel, begrenzt).
    const queue = [...missing];
    const worker = async () => {
      while (queue.length) {
        const id = queue.shift()!;
        try {
          const raw = await this.#json<RawAsset>(entityPath(id), { query: { langFallback: true } });
          const properties = await this.#json<RawProperty[]>(`${entityPath(id)}/properties`, {
            query: { langFallback: true },
          }).catch(() => [] as RawProperty[]);
          this.#listCache.set(id, mapAsset({ ...raw, properties: toArray(properties) }, this.#mapContext()));
        } catch {
          /* nicht (mehr) verfügbar – auslassen */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));
    return ids.map((id) => this.#listCache.get(id)).filter((a): a is Asset => !!a);
  }

  async #categoryPaths(id: string): Promise<Array<{ id: string; path: string }>> {
    const root = this.#config.detail.categoryRoot ?? this.#config.catalog.rootCategory;
    const relations = await this.#json<RawRelation[]>(`${entityPath(id)}/relations/search`, {
      body: {
        includeRelationTypeIdentifiers: ['ParentChild', 'Link'],
        pathSegmentFilter: root,
        includePaths: true,
        includeThumbnailUris: false,
        onlySearchDirectRelations: true,
      },
      query: { limit: 100, langFallback: true },
    });
    const result: Array<{ id: string; path: string }> = [];
    for (const relation of toArray(relations)) {
      const segments = relation.pathSegments ?? [];
      const start = segments.findIndex((s) => s.entity.identifier === root);
      const names = segments
        .slice(start + 1)
        .map((s) => resolveName(s.name, this.#locale, this.#config.locales.dataFallback))
        .filter(Boolean);
      if (names.length) result.push({ id: relation.fromEntity.identifier, path: names.join(' / ') });
    }
    return result;
  }

  async getRelated(id: string, types: string[]): Promise<Array<{ type: RelationType; assets: Asset[] }>> {
    if (!types.length) return [];
    const relations = await this.#json<RawRelation[]>(`${entityPath(id)}/relations/search`, {
      body: {
        includeRelationTypeIdentifiers: types,
        includePropertyDefinitionIdentifiers: [...this.#listFields(), 'customnode_name'],
        includePaths: false,
        includeThumbnailUris: true,
      },
      query: { langFallback: true, limit: 60, offset: 0 },
    });
    const ctx = this.#mapContext();
    const byType = new Map<string, Asset[]>();
    for (const relation of toArray(relations)) {
      const other = id.includes(relation.fromEntity.identifier) ? relation.toEntity : relation.fromEntity;
      const asset = mapAsset(other, ctx);
      if (!asset.title) {
        const fields = mapProperties(other.properties, ctx);
        asset.title = fields.file_name?.[0]?.label ?? fields.customnode_name?.[0]?.label ?? other.identifier;
      }
      asset.id = entityId(other);
      asset.thumbnail = thumbnailOf(other);
      const list = byType.get(relation.relationTypeIdentifier) ?? [];
      list.push(asset);
      byType.set(relation.relationTypeIdentifier, list);
    }
    return types
      .filter((t) => byType.has(t))
      .map((t) => ({
        type: this.#relations.get(t) ?? { id: t, label: t, searchable: false, allowed: [], order: 0 },
        assets: byType.get(t)!,
      }));
  }

  // ---------------------------------------------------------------------------------------------
  // Downloads

  async getDownloadFormats(id: string): Promise<DownloadFormat[]> {
    const path = entityPath(id);
    const [types, existing] = await Promise.all([
      this.#json<RawDerivationType[]>(`${path}/derivation-types`, { query: { langFallback: true } }),
      this.#json<RawDerivation[]>(`${path}/derivations`).catch(() => [] as RawDerivation[]),
    ]);
    const showPreviews = new Set(this.#config.download.showPreviewFormats);
    const available = new Map(toArray(existing).map((d) => [d.derivationTypeIdentifier, d]));
    const formats: DownloadFormat[] = [];
    for (const type of toArray(types)) {
      if (PREVIEW_ROLES(type) && type.identifier !== 'Original' && !showPreviews.has(type.identifier))
        continue;
      const derivation = available.get(type.identifier);
      const onDemand = !derivation && (type.assetTypeSettings?.some((s) => s.isOnDemand) ?? false);
      if (!derivation && !onDemand) continue;
      formats.push({
        id: type.identifier,
        label: resolveName(type.name, this.#locale, this.#config.locales.dataFallback) || type.identifier,
        description:
          derivation?.fileName && derivation.fileSize
            ? `${derivation.fileName} (${this.#formatBytes(derivation.fileSize)})`
            : derivation?.fileName,
        onDemand,
      });
    }
    return formats.sort((a, b) =>
      a.id === 'Original' ? -1 : b.id === 'Original' ? 1 : a.label.localeCompare(b.label),
    );
  }

  async getDownloadUrl(id: string, formatId: string, onProgress?: (state: string) => void): Promise<string> {
    const path = `${entityPath(id)}/derivations/${encodeURIComponent(formatId)}`;
    let derivation = await this.#json<RawDerivation>(path).catch((error: ApiError) => {
      if (error.status === 404) return null;
      throw error;
    });
    if (!derivation?.downloadUri) {
      // On-Demand-Derivat erzeugen und warten, bis es bereitsteht.
      onProgress?.('preparing');
      await this.#request(path, { method: 'POST' });
      for (let i = 0; i < 120; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        derivation = await this.#json<RawDerivation>(path).catch(() => null);
        if (derivation?.status === 'Finished' || (derivation?.downloadUri && !derivation.status)) break;
        if (derivation?.status === 'Failed') throw new ApiError(500, 'Derivat konnte nicht erzeugt werden');
      }
    }
    if (!derivation?.downloadUri) throw new ApiError(504, 'Derivat nicht verfügbar');
    return derivation.downloadUri;
  }

  async getZoomUrl(id: string): Promise<string | undefined> {
    const candidates = [this.#config.download.zoomFormat, 'Print', 'Screen'].filter((f): f is string => !!f);
    for (const format of candidates) {
      const derivation = await this.#json<RawDerivation>(
        `${entityPath(id)}/derivations/${encodeURIComponent(format)}`,
      ).catch(() => null);
      const url = derivation?.uri ?? derivation?.downloadUri;
      if (url) return url;
    }
    return undefined;
  }

  /**
   * ZIP-Download. Sharedien streamt ZIPs über einen Formular-POST (`assets/stream-formdata`);
   * der Token wird dabei als Formularfeld übergeben. Im Modus «fetch» (Demo/Tests) wird das ZIP
   * per fetch geladen und als Datei gespeichert.
   */
  async downloadZip(items: ZipItem[]): Promise<void> {
    const body = {
      assets: items.map((item) => ({ identifier: item.id, derivationTypeIdentifier: item.format })),
    };
    const token = await this.#getToken();
    const url = `${this.#base}/assets/stream-formdata`;
    if (this.#config.api.zipMode === 'fetch') {
      const data = new FormData();
      if (token) data.set('Authorization', `Bearer ${token}`);
      data.set('zipDownloadRequest', JSON.stringify(body));
      const response = await this.#fetch(url, { method: 'POST', body: data });
      if (!response.ok) throw new ApiError(response.status, 'ZIP-Download fehlgeschlagen');
      const blob = await response.blob();
      const name =
        /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '')?.[1] ??
        'bildarchiv.zip';
      saveBlob(blob, name);
      return;
    }
    const form = document.createElement('form');
    form.method = 'POST';
    form.enctype = 'multipart/form-data';
    form.action = url;
    form.target = 'ep-download-frame';
    form.hidden = true;
    const add = (name: string, value: string) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.append(input);
    };
    if (token) add('Authorization', `Bearer ${token}`);
    add('zipDownloadRequest', JSON.stringify(body));
    let frame = document.querySelector<HTMLIFrameElement>('iframe[name="ep-download-frame"]');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.name = 'ep-download-frame';
      frame.hidden = true;
      document.body.append(frame);
    }
    document.body.append(form);
    form.submit();
    form.remove();
  }

  // ---------------------------------------------------------------------------------------------
  // Kategorien / Sammlungen

  #mapCategory(raw: RawCategory): CategoryNode {
    return mapCategory(raw, this.#locale, this.#config.locales.dataFallback);
  }

  async getCategory(id: string): Promise<CategoryInfo> {
    const [raw, properties] = await Promise.all([
      this.#json<RawCategory>(`categories/${encodeURIComponent(id)}`, { query: { langFallback: true } }),
      this.#json<RawProperty[]>(`categories/${encodeURIComponent(id)}/properties`, {
        query: { langFallback: true },
      }).catch(() => [] as RawProperty[]),
    ]);
    const ctx = this.#mapContext();
    const groups = mapMetadataGroups(toArray(properties), ctx);
    const fields = groups.flatMap((g) => g.fields);
    const description = fields
      .find((f) => /desc|beschreib/i.test(f.id))
      ?.values.map((v) => v.label)
      .join('\n');
    return { ...this.#mapCategory(raw), description, fields };
  }

  async getCategoryChildren(id: string): Promise<CategoryNode[]> {
    const children: CategoryNode[] = [];
    let offset = 0;
    let total: number;
    do {
      const response = await this.#request(`categories/${encodeURIComponent(id)}/children`, {
        query: { offset, limit: 500, langFallback: true },
      });
      total = Number.parseInt(response.headers.get('x-total-count') ?? '', 10) || 0;
      const page = toArray((await response.json()) as RawCategory[]);
      children.push(...page.map((c) => this.#mapCategory(c)));
      offset += page.length;
      if (!page.length) break;
    } while (offset < total);
    return children;
  }

  async getCategoryPath(id: string): Promise<CategoryNode[]> {
    const path = await this.#json<RawPathItem[]>(`categories/${encodeURIComponent(id)}/path`, {
      query: { langFallback: true },
    });
    return toArray(path).map((item) => ({
      id: item.entity.identifier,
      name: resolveName(item.name, this.#locale, this.#config.locales.dataFallback) || item.entity.identifier,
      hasChildren: true,
    }));
  }

  async searchCategories(text: string, root?: string): Promise<CategoryNode[]> {
    if (text.trim().length < 2) return [];
    const json = await this.#json<{ items?: RawCategory[] }>('categories/quicksearch', {
      body: {
        q: text.trim(),
        exactSearch: false,
        recursivelyFilterCategories: true,
        ...(root ? { categories: [root] } : {}),
      },
      query: { langFallback: true, limit: 30, offset: 0 },
    });
    return (json?.items ?? []).map((c) => ({ ...this.#mapCategory(c), hasChildren: false }));
  }

  relationOptions(relationType: string, entityType?: string, filter?: string): Promise<FacetOption[]> {
    const key = `${relationType}|${entityType ?? ''}|${filter ?? ''}`;
    let promise = this.#relationOptionsCache.get(key);
    if (!promise) {
      promise = this.#loadRelationOptions(relationType, entityType, filter);
      this.#relationOptionsCache.set(key, promise);
      promise.catch(() => this.#relationOptionsCache.delete(key));
    }
    return promise;
  }

  async #loadRelationOptions(
    relationType: string,
    entityType?: string,
    filter?: string,
  ): Promise<FacetOption[]> {
    const relation = this.#relations.get(relationType);
    const pairs = relation?.allowed.filter((p) => !entityType || p.from === entityType) ?? [];
    const options: FacetOption[] = [];
    for (const pair of pairs.length ? pairs : [{ from: entityType ?? '', to: 'AssetSet' }]) {
      const body: Record<string, unknown> = {
        entityTypeIdentifier: pair.from,
        operator: 'And',
        relationFilters: [
          { relationTypeIdentifier: relationType, operator: 'HasRelation', entityTypeIdentifier: pair.to },
        ],
      };
      if (filter) {
        body.advancedSearchFilters = [
          {
            q: [filter],
            languages: [this.#locale],
            propertyDefinitionIdentifier: 'customnode_name',
            op: 'Contains',
            entityTypeIdentifier: pair.from,
          },
        ];
      }
      const json = await this.#json<{ items?: Array<{ identifier: string; name?: RawAsset['name'] }> }>(
        'custom-entities/search',
        { body, query: { langFallback: true, limit: 1000 } },
      );
      for (const item of json?.items ?? []) {
        options.push({ id: item.identifier, label: resolveName(item.name, this.#locale) || item.identifier });
      }
    }
    return options.sort((a, b) => a.label.localeCompare(b.label));
  }
}

function toArray<T>(value: T[] | Record<string, T> | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : Object.values(value);
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.dataset.router = 'off';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
