import * as v from 'valibot';

/** Text, der entweder für alle Sprachen gilt oder pro Sprache angegeben wird. */
const Localized = v.union([v.string(), v.record(v.string(), v.string())]);

const Hex = v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}$/, 'Farbe muss als #RRGGBB angegeben werden'));

const ThemeTokens = v.object({
  accent: Hex,
  bg: Hex,
  surface: Hex,
  raised: v.optional(Hex),
  text: Hex,
  muted: Hex,
  border: v.optional(Hex),
});

const Theme = v.object({
  label: v.optional(Localized),
  light: ThemeTokens,
  dark: ThemeTokens,
});

const FilterType = v.picklist(['facet', 'relation', 'date', 'text', 'category']);

const Filter = v.object({
  type: FilterType,
  /** Sharedien property-definition- bzw. relation-type-Identifier. */
  source: v.optional(v.string()),
  label: v.optional(Localized),
  open: v.optional(v.boolean()),
  radio: v.optional(v.boolean()),
  /** Für Relationsfilter: entityTypeIdentifier der verknüpften Entität. */
  valueType: v.optional(v.string()),
  /** Für Datumsfilter: Bereich des Jahrzehnt-Reglers. */
  decades: v.optional(v.tuple([v.number(), v.number()])),
  /** Für Textfilter: Standard-Operator. */
  operation: v.optional(v.string()),
});

const FixedFilter = v.object({
  source: v.string(),
  op: v.optional(v.string()),
  value: v.optional(v.string()),
});

const Link = v.object({ label: Localized, href: v.string() });

const MailOrUrl = v.object({
  mode: v.picklist(['mailto', 'url']),
  target: v.string(),
  subject: v.optional(Localized),
});

export const ConfigSchema = v.object({
  api: v.object({
    baseUrl: v.string(),
    version: v.string(),
    token: v.optional(v.string()),
    tokenUrl: v.optional(v.string()),
    browserIdentifier: v.optional(v.string()),
    mock: v.boolean(),
    zipMode: v.picklist(['form', 'fetch']),
  }),
  catalog: v.object({
    title: Localized,
    subtitle: v.optional(Localized),
    rootCategory: v.string(),
    pageSize: v.pipe(v.number(), v.integer(), v.minValue(10), v.maxValue(200)),
    recursiveCategories: v.boolean(),
    fixedFilters: v.array(FixedFilter),
  }),
  locales: v.object({
    ui: v.pipe(v.array(v.string()), v.minLength(1)),
    default: v.string(),
    dataFallback: v.optional(v.string()),
  }),
  search: v.object({
    sortOptions: v.array(v.object({ id: v.string(), label: Localized })),
    defaultSort: v.string(),
    historySize: v.pipe(v.number(), v.integer(), v.minValue(0)),
    suggestions: v.boolean(),
    aiSearch: v.picklist(['auto', 'off']),
    defaultView: v.picklist(['justified', 'grid', 'list']),
  }),
  filters: v.array(Filter),
  addableFilters: v.boolean(),
  fields: v.object({
    title: v.optional(v.string()),
    date: v.optional(v.string()),
    creator: v.optional(v.string()),
    width: v.optional(v.string()),
    height: v.optional(v.string()),
    license: v.optional(v.string()),
    coordinates: v.optional(v.string()),
    signature: v.optional(v.string()),
  }),
  results: v.object({
    tableColumns: v.array(v.object({ field: v.string(), label: v.optional(Localized) })),
  }),
  detail: v.object({
    foldedGroups: v.array(v.string()),
    hiddenFields: v.array(v.string()),
    drillDownFields: v.array(v.string()),
    relations: v.array(v.string()),
    categoryRoot: v.optional(v.string()),
    reportIssue: v.optional(MailOrUrl),
  }),
  download: v.object({
    previewFormat: v.string(),
    zoomFormat: v.optional(v.string()),
    showPreviewFormats: v.array(v.string()),
    restriction: v.optional(v.object({ field: v.string(), value: v.string() })),
    order: v.optional(MailOrUrl),
  }),
  basket: v.object({
    enabled: v.boolean(),
    max: v.pipe(v.number(), v.integer(), v.minValue(1)),
    termsOfUse: v.picklist(['off', 'show', 'require']),
    termsText: v.optional(Localized),
    clearAfterDownload: v.boolean(),
    defaultFormat: v.string(),
  }),
  export: v.object({
    fields: v.array(v.string()),
    delimiter: v.picklist([';', ',']),
  }),
  compare: v.object({ enabled: v.boolean() }),
  map: v.object({
    enabled: v.boolean(),
    styles: v.object({ light: v.string(), dark: v.optional(v.string()) }),
    center: v.tuple([v.number(), v.number()]),
    zoom: v.number(),
    maxMarkers: v.pipe(v.number(), v.integer(), v.minValue(1)),
    attribution: v.optional(v.string()),
  }),
  home: v.object({
    heroAssets: v.array(v.string()),
    featuredCategories: v.array(v.string()),
    discoverQueries: v.array(v.string()),
    stats: v.array(v.object({ value: v.string(), label: Localized })),
  }),
  analytics: v.object({
    matomo: v.object({ enabled: v.boolean(), url: v.string(), siteId: v.string() }),
  }),
  branding: v.object({
    name: Localized,
    owner: v.optional(Localized),
    logo: v.optional(v.string()),
    links: v.array(Link),
    footerText: v.optional(Localized),
  }),
  theme: v.object({
    active: v.string(),
    themes: v.record(v.string(), Theme),
    fonts: v.object({ display: v.string(), ui: v.string() }),
    radiusScale: v.number(),
  }),
});

export type AppConfig = v.InferOutput<typeof ConfigSchema>;
export type LocalizedText = v.InferOutput<typeof Localized>;
export type FilterConfig = v.InferOutput<typeof Filter>;
export type ThemeDefinition = v.InferOutput<typeof Theme>;
export type ThemeTokenSet = v.InferOutput<typeof ThemeTokens>;
export type FixedFilterConfig = v.InferOutput<typeof FixedFilter>;
