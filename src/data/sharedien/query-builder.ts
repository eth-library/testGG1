import type { FilterConfig, FixedFilterConfig } from '../../config/schema.ts';
import type { SearchState } from '../../state/search-state.ts';
import type { FieldDefinition, RelationType } from '../model.ts';
import type { SearchBody } from './types.ts';

export interface QueryContext {
  locale: string;
  filters: FilterConfig[];
  fixedFilters: FixedFilterConfig[];
  fields: Map<string, FieldDefinition>;
  relations: Map<string, RelationType>;
  coordinatesField?: string;
  recursive: boolean;
  /** Felder, die in der Antwort enthalten sein sollen. */
  include: string[];
  /** Facetten anfordern (nur auf der ersten Seite sinnvoll). */
  facetSources: string[];
}

const endOfDay = (date: string) => `${date}T23:59:59.999Z`;
const startOfDay = (date: string) => `${date}T00:00:00.000Z`;

/**
 * Übersetzt den fachlichen Suchzustand in den Request-Body von `POST assets/search`.
 * Reine Funktion – vollständig unit-getestet.
 */
export function buildSearchBody(state: SearchState, ctx: QueryContext): SearchBody {
  const body: SearchBody = {
    categories: [],
    advancedSearchFilters: [],
    relationFilters: [],
    facetPropertyDefinitionIdentifiers: [...new Set(ctx.facetSources)],
    includePropertyDefinitionIdentifiers: [...new Set(ctx.include)],
    recursivelyFilterCategories: ctx.recursive,
  };

  // Volltext: "Phrase" → exakte Suche; UND/ODER; optional semantische Suche.
  const q = state.q.trim();
  if (q) {
    if (q.length > 1 && q.startsWith('"') && q.endsWith('"')) {
      body.q = q.slice(1, -1);
      body.exactSearch = true;
    } else {
      body.q = q;
    }
    if (state.mode === 'and') body.operator = 'And';
    if (state.ai) body.semanticSearch = true;
  }

  if (state.category) body.categories.push(state.category);

  const relationSources = new Set(ctx.filters.filter((f) => f.type === 'relation').map((f) => f.source));

  for (const [source, values] of Object.entries(state.facets)) {
    if (!values.length) continue;
    if (relationSources.has(source) || (ctx.relations.has(source) && !ctx.fields.has(source))) {
      const config = ctx.filters.find((f) => f.type === 'relation' && f.source === source);
      const entityType = config?.valueType ?? ctx.relations.get(source)?.allowed[0]?.from;
      for (const value of values) {
        body.relationFilters.push({
          operator: 'HasRelation',
          relationTypeIdentifier: source,
          entityIdentifier: value,
          ...(entityType ? { entityTypeIdentifier: entityType } : {}),
        });
      }
    } else {
      // Wie die bisherige App: ein Filter je gewähltem Wert.
      for (const value of values) {
        body.advancedSearchFilters.push({
          op: 'IdentifierEquals',
          propertyDefinitionIdentifier: source,
          q: [value],
        });
      }
    }
  }

  for (const [source, range] of Object.entries(state.dates)) {
    const isDateTime = ctx.fields.get(source)?.type === 'datetime';
    const from = range.from ? (isDateTime ? startOfDay(range.from) : range.from) : undefined;
    const to = range.to ? (isDateTime ? endOfDay(range.to) : range.to) : undefined;
    if (from && to) {
      body.advancedSearchFilters.push(
        range.from === range.to && !isDateTime
          ? { op: 'Equals', propertyDefinitionIdentifier: source, q: [from] }
          : { op: 'Between', propertyDefinitionIdentifier: source, q: [from, to] },
      );
    } else if (from) {
      body.advancedSearchFilters.push({
        op: 'GreaterThanOrEquals',
        propertyDefinitionIdentifier: source,
        q: [from],
      });
    } else if (to) {
      body.advancedSearchFilters.push({
        op: 'LessThanOrEquals',
        propertyDefinitionIdentifier: source,
        q: [to],
      });
    }
  }

  for (const [source, text] of Object.entries(state.texts)) {
    if (!text.value.trim()) continue;
    body.advancedSearchFilters.push({
      op: text.op || 'Contains',
      propertyDefinitionIdentifier: source,
      q: [text.value.trim()],
      ...(ctx.fields.get(source)?.translatable ? { languages: [ctx.locale] } : {}),
    });
  }

  if (state.geo && ctx.coordinatesField) {
    const { north, west, south, east } = state.geo;
    body.advancedSearchFilters.push({
      op: 'InBoundingBox',
      propertyDefinitionIdentifier: ctx.coordinatesField,
      q: [`${north},${west}`, `${south},${east}`],
    });
  }

  for (const fixed of ctx.fixedFilters) {
    if (fixed.source === 'categories') {
      if (fixed.value) body.categories.push(fixed.value);
    } else if (fixed.op === 'HasValue' || fixed.op === 'HasNoValue') {
      body.advancedSearchFilters.push({ op: fixed.op, propertyDefinitionIdentifier: fixed.source });
    } else if (fixed.value !== undefined) {
      body.advancedSearchFilters.push({
        op: fixed.op ?? 'IdentifierEquals',
        propertyDefinitionIdentifier: fixed.source,
        q: [fixed.value],
      });
    }
  }

  const sort = parseSort(state.sort);
  if (sort) {
    body.sort = [
      {
        propertyDefinitionIdentifier: sort.field,
        // Sharedien verlangt eine Sprache nur bei übersetzbaren Feldern.
        languageIdentifier: ctx.fields.get(sort.field)?.translatable ? ctx.locale : null,
        direction: sort.direction === 'asc' ? 'Asc' : 'Desc',
      },
    ];
  }

  return body;
}

/** «relevance» → null, «date_desc» → { field: 'date', direction: 'desc' } */
export function parseSort(sort: string): { field: string; direction: 'asc' | 'desc' } | null {
  if (!sort || sort === 'relevance') return null;
  const match = sort.match(/^(.+)_(asc|desc)$/);
  return match
    ? { field: match[1], direction: match[2] as 'asc' | 'desc' }
    : { field: sort, direction: 'asc' };
}
