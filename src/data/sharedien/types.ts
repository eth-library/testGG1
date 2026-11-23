/**
 * Ausschnitt der Sharedien REST API v13, soweit vom Katalog genutzt.
 * Quelle: Sharedien-Dokumentation (OpenAPI unter <api>/swagger/v13/swagger.json) und Beobachtung der API.
 */

export interface LangValue {
  value: string | number | boolean | null;
  dataLanguageIdentifier?: string | null;
}

export interface RawPropertyValue {
  propertyListItemIdentifier?: string | null;
  propertyValue: LangValue[] | null;
}

export interface RawProperty {
  propertyDefinitionIdentifier: string;
  propertyValues: RawPropertyValue[];
}

export interface RawAsset {
  identifier: string;
  fileName?: string;
  assetType?: string;
  entityTypeIdentifier?: string;
  thumbnailUri?: string | null;
  watermarkThumbnailUri?: string | null;
  avatarUrl?: string | null;
  created?: string;
  version?: number;
  name?: LangValue[];
  properties?: RawProperty[];
}

export interface RawFacet {
  propertyDefinitionIdentifier: string;
  items: Array<{ term: string; count: number }>;
}

export interface RawSearchResponse {
  items: RawAsset[];
  cursor?: string | null;
  facets?: RawFacet[];
}

export interface RawListItem {
  identifier: string;
  value: LangValue[];
  status?: string;
  sortKey?: number;
}

export interface RawPropertyDefinition {
  identifier: string;
  name: LangValue[];
  description?: LangValue[];
  valueType: string;
  definitionType?: string;
  isList?: boolean;
  translatable?: boolean;
  listItems?: RawListItem[];
  propertyGroupIdentifier?: string;
  sortKey?: number;
  searchOption?: string;
  active?: boolean;
  status?: string;
}

export interface RawPropertyGroup {
  identifier: string;
  name: LangValue[];
  sortKey?: number;
}

export interface RawDerivation {
  identifier?: string;
  derivationTypeIdentifier: string;
  uri?: string;
  downloadUri?: string;
  fileMimeType?: string;
  fileName?: string;
  fileSize?: number;
  fileTypeIdentifier?: string;
  assetTypeIdentifier?: string;
  status?: string;
}

export interface RawDerivationType {
  identifier: string;
  name?: LangValue[];
  assetTypeSettings: Array<{ isOnDemand?: boolean; useAsThumbnail?: boolean; useAsPreview?: boolean }>;
}

export interface RawCategory {
  identifier: string;
  name: LangValue[];
  hasSubCategories?: boolean;
  thumbnailUri?: string | null;
  watermarkThumbnailUri?: string | null;
  avatarUrl?: string | null;
}

export interface RawPathItem {
  entity: { identifier: string };
  name?: LangValue[];
}

export interface RawRelationType {
  identifier: string;
  name: LangValue[];
  description?: LangValue[];
  isUsedForAssetSearch?: boolean;
  status?: string;
  isSystem?: boolean;
  displayMode?: string;
  order?: number;
  allowedEntityRelations?: Array<{ fromEntityTypeIdentifier: string; toEntityTypeIdentifier: string }>;
}

export interface RawEntity extends RawAsset {
  entityTypeIdentifier: string;
}

export interface RawRelation {
  relationTypeIdentifier: string;
  fromEntity: RawEntity;
  toEntity: RawEntity;
  pathSegments?: Array<{ entity: { identifier: string }; name?: LangValue[] }>;
}

export interface AdvancedFilter {
  op: string;
  propertyDefinitionIdentifier: string;
  q?: string[];
  languages?: string[];
}

export interface RelationFilter {
  operator: 'HasRelation';
  relationTypeIdentifier: string;
  entityIdentifier?: string;
  entityTypeIdentifier?: string;
}

export interface SearchBody {
  q?: string;
  operator?: 'And' | 'Or';
  exactSearch?: boolean;
  semanticSearch?: boolean;
  categories: string[];
  advancedSearchFilters: AdvancedFilter[];
  relationFilters: RelationFilter[];
  facetPropertyDefinitionIdentifiers: string[];
  sort?: Array<{
    propertyDefinitionIdentifier: string;
    languageIdentifier: string | null;
    direction: 'Asc' | 'Desc';
  }>;
  includePropertyDefinitionIdentifiers: string[];
  recursivelyFilterCategories: boolean;
}
