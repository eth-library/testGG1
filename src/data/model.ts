/** Fachliches Datenmodell der App – unabhängig vom DAM (Sharedien). */

import type { SearchState } from '../state/search-state.ts';

export type MediaType = 'image' | 'video' | 'audio' | 'pdf' | 'other';

export interface FieldValue {
  /** Identifier eines Listenwerts bzw. einer verknüpften Entität (für Drill-down). */
  id?: string;
  label: string;
  /** Rohwert, z. B. ISO-Datum. */
  raw?: string;
}

/** Ein Bild in Trefferlisten (schlank). */
export interface Asset {
  id: string;
  title: string;
  thumbnail: string;
  /** Grösseres Vorschaubild, falls in der Liste bekannt. */
  preview?: string;
  width?: number;
  height?: number;
  date?: string;
  mediaType: MediaType;
  /** Flache Metadaten für Karten, Tabelle, Export: fieldId → Werte. */
  fields: Record<string, FieldValue[]>;
  downloadable: boolean;
  coordinates?: [number, number];
}

export interface MetadataField {
  id: string;
  label: string;
  description?: string;
  values: FieldValue[];
  html?: boolean;
  order: number;
}

export interface MetadataGroup {
  id: string;
  label: string;
  order: number;
  fields: MetadataField[];
}

export interface AssetDetail extends Asset {
  fileName?: string;
  preview: string;
  previewMime?: string;
  groups: MetadataGroup[];
  /** Kategoriepfade («Sammlung / Untersammlung»). */
  categories: Array<{ id: string; path: string }>;
}

export type FieldType =
  'list' | 'text' | 'html' | 'date' | 'datetime' | 'number' | 'boolean' | 'geo' | 'other';

export interface FieldDefinition {
  id: string;
  label: string;
  description?: string;
  type: FieldType;
  isList: boolean;
  translatable: boolean;
  searchable: boolean;
  groupId?: string;
  order: number;
  options: Map<string, string>;
}

export interface RelationType {
  id: string;
  label: string;
  description?: string;
  searchable: boolean;
  /** Zulässige Entitätspaare: from = Typ der verknüpften Entität (z. B. Person), to = Asset-Typ. */
  allowed: Array<{ from: string; to: string }>;
  order: number;
}

export interface CategoryNode {
  id: string;
  name: string;
  hasChildren: boolean;
  thumbnail?: string;
  children?: CategoryNode[];
}

export interface CategoryInfo extends CategoryNode {
  description?: string;
  fields: MetadataField[];
}

export interface DownloadFormat {
  id: string;
  label: string;
  /** z. B. «bild.tif (24,3 MB)» */
  description?: string;
  onDemand: boolean;
}

export interface FacetCounts {
  /** source → (Wert-Identifier → Anzahl) */
  [source: string]: Map<string, number>;
}

export interface SearchPage {
  items: Asset[];
  total: number;
  cursor?: string;
  facets?: FacetCounts;
}

export interface SearchRequest {
  state: SearchState;
  pageSize: number;
  cursor?: string;
  /** Facetten, deren Zählung angefordert wird (nur erste Seite). */
  facetSources: string[];
  /** Zusätzlich zu ladende Felder. */
  fields?: string[];
}

export interface ZipItem {
  id: string;
  format: string;
}

export interface FacetOption {
  id: string;
  label: string;
}

/** Schnittstelle zum DAM. Implementiert durch den Sharedien-Client (und den Demo-Mock). */
export interface CatalogAdapter {
  init(locale: string): Promise<void>;
  setLocale(locale: string): Promise<void>;
  fieldDefinitions(): Map<string, FieldDefinition>;
  relationTypes(): Map<string, RelationType>;
  search(request: SearchRequest, signal?: AbortSignal): Promise<SearchPage>;
  suggest(text: string, state: SearchState, signal?: AbortSignal): Promise<string[]>;
  getAsset(id: string): Promise<AssetDetail>;
  getAssets(ids: string[]): Promise<Asset[]>;
  getRelated(id: string, relationTypes: string[]): Promise<Array<{ type: RelationType; assets: Asset[] }>>;
  getDownloadFormats(id: string): Promise<DownloadFormat[]>;
  getDownloadUrl(id: string, formatId: string, onProgress?: (state: string) => void): Promise<string>;
  getZoomUrl(id: string): Promise<string | undefined>;
  downloadZip(items: ZipItem[]): Promise<void>;
  getCategory(id: string): Promise<CategoryInfo>;
  getCategoryChildren(id: string): Promise<CategoryNode[]>;
  getCategoryPath(id: string): Promise<CategoryNode[]>;
  searchCategories(text: string, root?: string): Promise<CategoryNode[]>;
  /** Namen der Werte eines Relationsfilters (z. B. Personen). */
  relationOptions(relationType: string, entityType?: string, filter?: string): Promise<FacetOption[]>;
  isAiSearchEnabled(): Promise<boolean>;
}
