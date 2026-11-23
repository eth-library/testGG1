import type {
  Asset,
  CategoryNode,
  FieldDefinition,
  FieldType,
  FieldValue,
  MediaType,
  MetadataField,
  MetadataGroup,
  RelationType,
} from '../model.ts';
import type {
  LangValue,
  RawAsset,
  RawCategory,
  RawProperty,
  RawPropertyDefinition,
  RawPropertyGroup,
  RawRelationType,
} from './types.ts';

export interface MapContext {
  locale: string;
  fallbackLocale?: string;
  fields: Map<string, FieldDefinition>;
  groups: Map<string, { id: string; label: string; order: number }>;
  hidden: Set<string>;
  config: {
    title?: string;
    date?: string;
    width?: string;
    height?: string;
    coordinates?: string;
    restriction?: { field: string; value: string };
  };
  formatDate: (iso: string, type: FieldType) => string;
  formatBytes: (bytes: number) => string;
}

/** Wählt aus einem mehrsprachigen Namen die gewünschte Sprache (sonst die erste). */
export function resolveName(
  values: LangValue[] | undefined | null,
  locale: string,
  fallback?: string,
): string {
  if (!values?.length) return '';
  const pick = (lang?: string) => values.find((v) => v.dataLanguageIdentifier === lang)?.value;
  const value = pick(locale) ?? (fallback ? pick(fallback) : undefined) ?? values[0]?.value;
  return value === null || value === undefined ? '' : String(value);
}

/** Werte eines Feldes in der aktuellen Sprache (sprachneutrale Werte immer). */
function localizedValues(
  values: LangValue[] | null | undefined,
  locale: string,
  fallback?: string,
): string[] {
  if (!values?.length) return [];
  const match = values.filter((v) => !v.dataLanguageIdentifier || v.dataLanguageIdentifier === locale);
  const chosen =
    match.length || !fallback ? match : values.filter((v) => v.dataLanguageIdentifier === fallback);
  return chosen
    .map((v) => v.value)
    .filter((v) => v !== null && v !== '')
    .map(String);
}

export function mapFieldType(def: RawPropertyDefinition): FieldType {
  const type = def.valueType ?? '';
  if (def.definitionType?.includes('Html')) return 'html';
  if (/DateTime/i.test(type)) return 'datetime';
  if (/Date/i.test(type)) return 'date';
  if (/Geo|Location|Coordinate/i.test(type)) return 'geo';
  if (/Number|Integer|Decimal|Double|Float|Long/i.test(type)) return 'number';
  if (/Bool/i.test(type)) return 'boolean';
  if (/List/i.test(type) || def.listItems?.length) return 'list';
  if (/String|Text/i.test(type)) return 'text';
  return 'other';
}

export function mapFieldDefinition(
  def: RawPropertyDefinition,
  locale: string,
  fallback?: string,
): FieldDefinition {
  const options = new Map<string, string>();
  const items = [...(def.listItems ?? [])].sort((a, b) => (a.sortKey ?? 0) - (b.sortKey ?? 0));
  for (const item of items) {
    if (!item.status || item.status === 'Active')
      options.set(item.identifier, resolveName(item.value, locale, fallback));
  }
  const description = resolveName(def.description, locale, fallback);
  return {
    id: def.identifier,
    label: resolveName(def.name, locale, fallback) || def.identifier,
    description: description || undefined,
    type: mapFieldType(def),
    isList: !!def.isList || /List/i.test(def.valueType ?? ''),
    translatable: !!def.translatable,
    searchable: def.active !== false && def.searchOption !== 'NotSearchable',
    groupId: def.propertyGroupIdentifier,
    order: def.sortKey ?? 0,
    options,
  };
}

export function mapGroup(group: RawPropertyGroup, locale: string, fallback?: string) {
  return {
    id: group.identifier,
    label: resolveName(group.name, locale, fallback),
    order: group.sortKey ?? 0,
  };
}

export function mapRelationType(raw: RawRelationType, locale: string, fallback?: string): RelationType {
  return {
    id: raw.identifier,
    label: resolveName(raw.name, locale, fallback) || raw.identifier,
    description: resolveName(raw.description, locale, fallback) || undefined,
    searchable: !!raw.isUsedForAssetSearch && raw.status?.toLowerCase() !== 'inactive' && !raw.isSystem,
    allowed: (raw.allowedEntityRelations ?? []).map((r) => ({
      from: r.fromEntityTypeIdentifier,
      to: r.toEntityTypeIdentifier,
    })),
    order: raw.order ?? 0,
  };
}

/** Rohwerte eines Feldes → anzeigbare Werte. */
export function mapPropertyValues(
  property: RawProperty,
  def: FieldDefinition | undefined,
  ctx: MapContext,
): FieldValue[] {
  const result: FieldValue[] = [];
  for (const entry of property.propertyValues ?? []) {
    const listId = entry.propertyListItemIdentifier ?? undefined;
    const texts = localizedValues(entry.propertyValue, ctx.locale, ctx.fallbackLocale);
    if (listId) {
      const label = def?.options.get(listId) ?? texts[0] ?? listId;
      result.push({ id: listId, label, raw: listId });
      continue;
    }
    for (const text of texts) {
      if (def && (def.type === 'date' || def.type === 'datetime')) {
        result.push({ label: ctx.formatDate(text, def.type), raw: text });
      } else if (property.propertyDefinitionIdentifier === 'file_size' && Number.isFinite(Number(text))) {
        result.push({ label: ctx.formatBytes(Number(text)), raw: text });
      } else {
        result.push({ label: text, raw: text });
      }
    }
  }
  return result;
}

export function mapProperties(
  properties: RawProperty[] | undefined,
  ctx: MapContext,
): Record<string, FieldValue[]> {
  const fields: Record<string, FieldValue[]> = {};
  for (const property of properties ?? []) {
    const values = mapPropertyValues(property, ctx.fields.get(property.propertyDefinitionIdentifier), ctx);
    if (values.length) fields[property.propertyDefinitionIdentifier] = values;
  }
  return fields;
}

export function thumbnailOf(raw: {
  watermarkThumbnailUri?: string | null;
  avatarUrl?: string | null;
  thumbnailUri?: string | null;
}) {
  return raw.watermarkThumbnailUri || raw.avatarUrl || raw.thumbnailUri || '';
}

export function mediaTypeOf(assetType?: string, mime?: string): MediaType {
  const value = `${assetType ?? ''} ${mime ?? ''}`.toLowerCase();
  if (/movie|video/.test(value)) return 'video';
  if (/audio|sound/.test(value)) return 'audio';
  if (/pdf/.test(value)) return 'pdf';
  if (/image|picture|photo|jpe?g|png|tiff?/.test(value) || !value.trim()) return 'image';
  return 'other';
}

const firstNumber = (values?: FieldValue[]) => {
  const n = Number(values?.[0]?.raw ?? values?.[0]?.label);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** «47.37,8.54» oder «47.37 8.54» → [lat, lng] */
export function parseCoordinates(value?: string): [number, number] | undefined {
  if (!value) return undefined;
  const parts = value
    .split(/[,;\s]+/)
    .map(Number)
    .filter(Number.isFinite);
  if (parts.length < 2) return undefined;
  const [lat, lng] = parts;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return [lat, lng];
}

export function mapAsset(raw: RawAsset, ctx: MapContext): Asset {
  const fields = mapProperties(raw.properties, ctx);
  const { config } = ctx;
  const titleValues = config.title ? fields[config.title] : undefined;
  const title =
    titleValues?.map((v) => v.label).join(' · ') || resolveName(raw.name, ctx.locale) || raw.fileName || '';
  const restriction = config.restriction;
  const restricted =
    !!restriction &&
    (fields[restriction.field] ?? []).some((v) => v.id === restriction.value || v.raw === restriction.value);
  return {
    id: entityId(raw),
    title,
    thumbnail: thumbnailOf(raw),
    width: config.width ? firstNumber(fields[config.width]) : undefined,
    height: config.height ? firstNumber(fields[config.height]) : undefined,
    date: config.date ? fields[config.date]?.map((v) => v.label).join(', ') : undefined,
    mediaType: mediaTypeOf(raw.assetType),
    fields,
    downloadable: !restricted,
    coordinates: config.coordinates ? parseCoordinates(fields[config.coordinates]?.[0]?.raw) : undefined,
  };
}

/** Eigene Entitäten (keine Assets) werden als «<typ>_<id>» geführt – wie in Sharedien-Pfaden. */
export function entityId(raw: { identifier: string; entityTypeIdentifier?: string }): string {
  if (raw.entityTypeIdentifier && !raw.entityTypeIdentifier.startsWith('Asset')) {
    return `${raw.entityTypeIdentifier}_${raw.identifier}`;
  }
  return raw.identifier;
}

/** Pfad-Fragment für ein Asset bzw. eine eigene Entität. */
export function entityPath(id: string): string {
  const separator = id.lastIndexOf('_');
  if (separator === -1) return `assets/${encodeURIComponent(id)}`;
  return `custom-entities/${encodeURIComponent(id.slice(0, separator))}/${encodeURIComponent(id.slice(separator + 1))}`;
}

/** Eigenschaften eines Assets → nach Property-Gruppen sortierte Abschnitte. */
export function mapMetadataGroups(properties: RawProperty[], ctx: MapContext): MetadataGroup[] {
  const groups = new Map<string, MetadataGroup>();
  for (const property of properties) {
    const id = property.propertyDefinitionIdentifier;
    if (ctx.hidden.has(id)) continue;
    const def = ctx.fields.get(id);
    if (!def) continue;
    const values = mapPropertyValues(property, def, ctx);
    if (!values.length) continue;
    const groupMeta = (def.groupId && ctx.groups.get(def.groupId)) || {
      id: '_other',
      label: '',
      order: 99999,
    };
    let group = groups.get(groupMeta.id);
    if (!group) {
      group = { id: groupMeta.id, label: groupMeta.label, order: groupMeta.order, fields: [] };
      groups.set(groupMeta.id, group);
    }
    const field: MetadataField = {
      id,
      label: def.label,
      description: def.description,
      values,
      html: def.type === 'html',
      order: def.order,
    };
    group.fields.push(field);
  }
  const sorted = [...groups.values()].sort((a, b) => a.order - b.order);
  for (const group of sorted) group.fields.sort((a, b) => a.order - b.order);
  return sorted;
}

export function mapCategory(
  raw: RawCategory,
  locale: string,
  fallback?: string,
  rootLabel?: string,
): CategoryNode {
  return {
    id: raw.identifier,
    name:
      raw.identifier === 'root' && rootLabel
        ? rootLabel
        : resolveName(raw.name, locale, fallback) || raw.identifier,
    hasChildren: !!raw.hasSubCategories,
    thumbnail: thumbnailOf(raw) || undefined,
  };
}
