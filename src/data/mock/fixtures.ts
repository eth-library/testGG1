/**
 * Demo-Datenbestand im Format der Sharedien API. Titel, Personen und Bilder sind erfunden;
 * die Struktur (Felder, Gruppen, Kategorien, Relationen) entspricht einem typischen Bildarchiv.
 */
import type {
  LangValue,
  RawCategory,
  RawProperty,
  RawPropertyDefinition,
  RawPropertyGroup,
  RawRelationType,
} from '../sharedien/types.ts';
import { hashString, rng, type Scene } from './placeholder.ts';

const L = (de: string, en?: string): LangValue[] =>
  en
    ? [
        { value: de, dataLanguageIdentifier: 'de' },
        { value: en, dataLanguageIdentifier: 'en' },
      ]
    : [{ value: de }];

type ListSpec = Array<[id: string, de: string, en?: string]>;

const list = (items: ListSpec) =>
  items.map(([identifier, de, en], i) => ({ identifier, value: L(de, en), status: 'Active', sortKey: i }));

export const PHOTOGRAPHERS: ListSpec = [
  ['ph_amsler', 'Amsler, Clara'],
  ['ph_baumann', 'Baumann, Ernst'],
  ['ph_corrodi', 'Corrodi, Lea'],
  ['ph_durrer', 'Durrer, Franz'],
  ['ph_egli', 'Egli, Margrit'],
  ['ph_frey', 'Frey, Otto'],
  ['ph_gautschi', 'Gautschi, Hanna'],
  ['ph_unbekannt', 'Unbekannt', 'Unknown'],
];

export const LOCATIONS: Array<
  [id: string, de: string, en: string, lat: number, lng: number, scene: Scene[]]
> = [
  ['loc_zuerich', 'Zürich', 'Zurich', 47.3769, 8.5417, ['city', 'campus', 'lake']],
  ['loc_luzern', 'Luzern', 'Lucerne', 47.0502, 8.3093, ['lake', 'city', 'postcard']],
  ['loc_bern', 'Bern', 'Bern', 46.948, 7.4474, ['city', 'aerial']],
  ['loc_basel', 'Basel', 'Basel', 47.5596, 7.5886, ['city', 'aerial']],
  ['loc_genf', 'Genf', 'Geneva', 46.2044, 6.1432, ['lake', 'city']],
  ['loc_lugano', 'Lugano', 'Lugano', 46.0037, 8.9511, ['lake', 'postcard']],
  ['loc_zermatt', 'Zermatt', 'Zermatt', 46.0207, 7.7491, ['alps', 'postcard']],
  ['loc_jungfrau', 'Jungfraujoch', 'Jungfraujoch', 46.5475, 7.9853, ['alps', 'lab']],
  ['loc_davos', 'Davos', 'Davos', 46.8027, 9.836, ['alps', 'aerial']],
  ['loc_stmoritz', 'St. Moritz', 'St. Moritz', 46.4908, 9.8355, ['lake', 'alps', 'postcard']],
  ['loc_gotthard', 'Gotthard', 'Gotthard', 46.5591, 8.5615, ['alps', 'aerial']],
  ['loc_rigi', 'Rigi', 'Rigi', 47.0566, 8.4855, ['alps', 'postcard']],
];

const KEYWORDS: ListSpec = [
  ['kw_landschaft', 'Landschaft', 'Landscape'],
  ['kw_architektur', 'Architektur', 'Architecture'],
  ['kw_verkehr', 'Verkehr', 'Transport'],
  ['kw_eisenbahn', 'Eisenbahn', 'Railway'],
  ['kw_luftfahrt', 'Luftfahrt', 'Aviation'],
  ['kw_wissenschaft', 'Wissenschaft', 'Science'],
  ['kw_hochschule', 'Hochschule', 'University'],
  ['kw_tourismus', 'Tourismus', 'Tourism'],
  ['kw_gletscher', 'Gletscher', 'Glacier'],
  ['kw_see', 'See', 'Lake'],
  ['kw_portraet', 'Porträt', 'Portrait'],
  ['kw_industrie', 'Industrie', 'Industry'],
  ['kw_strassenszene', 'Strassenszene', 'Street scene'],
  ['kw_winter', 'Winter', 'Winter'],
];

const MATERIALS: ListSpec = [
  ['mat_glas', 'Glasplattennegativ', 'Glass plate negative'],
  ['mat_dia', 'Diapositiv', 'Slide'],
  ['mat_abzug', 'Fotoabzug', 'Photographic print'],
  ['mat_karte', 'Ansichtskarte', 'Postcard'],
  ['mat_film', 'Filmnegativ', 'Film negative'],
];

const LICENSES: ListSpec = [
  ['lic_pdm', 'Public Domain Mark 1.0', 'Public Domain Mark 1.0'],
  ['lic_ccbysa', 'CC BY-SA 4.0', 'CC BY-SA 4.0'],
  ['lic_reserved', 'Rechte vorbehalten – freier Zugang', 'In copyright – free access'],
];

const ORDER: ListSpec = [
  ['dl_free', 'Frei herunterladbar', 'Free download'],
  ['dl_order', 'Nur auf Bestellung', 'On request only'],
];

export const PROPERTY_GROUPS: RawPropertyGroup[] = [
  { identifier: 'grp_main', name: L('Beschreibung', 'Description'), sortKey: 1 },
  { identifier: 'grp_context', name: L('Entstehung & Ort', 'Creation & place'), sortKey: 2 },
  { identifier: 'grp_rights', name: L('Rechte & Nutzung', 'Rights & usage'), sortKey: 3 },
  { identifier: 'grp_tech', name: L('Technische Angaben', 'Technical details'), sortKey: 4 },
];

export const PROPERTY_DEFINITIONS: RawPropertyDefinition[] = [
  {
    identifier: 'ba_title',
    name: L('Titel', 'Title'),
    valueType: 'String',
    propertyGroupIdentifier: 'grp_main',
    sortKey: 1,
  },
  {
    identifier: 'ba_description',
    name: L('Beschreibung', 'Description'),
    description: L('Bildinhalt gemäss Erschliessung', 'Image content as catalogued'),
    valueType: 'String',
    propertyGroupIdentifier: 'grp_main',
    sortKey: 2,
  },
  {
    identifier: 'ba_keywords',
    name: L('Schlagworte', 'Keywords'),
    valueType: 'List of String',
    isList: true,
    listItems: list(KEYWORDS),
    propertyGroupIdentifier: 'grp_main',
    sortKey: 3,
  },
  {
    identifier: 'ba_date',
    name: L('Datierung', 'Date'),
    description: L('Aufnahmedatum, teilweise erschlossen', 'Date of photograph, partly inferred'),
    valueType: 'Date',
    propertyGroupIdentifier: 'grp_context',
    sortKey: 1,
  },
  {
    identifier: 'ba_photographer',
    name: L('Fotograf/in', 'Photographer'),
    valueType: 'List of String',
    listItems: list(PHOTOGRAPHERS),
    propertyGroupIdentifier: 'grp_context',
    sortKey: 2,
  },
  {
    identifier: 'ba_location',
    name: L('Ort', 'Place'),
    valueType: 'List of String',
    listItems: list(LOCATIONS.map(([id, de, en]) => [id, de, en])),
    propertyGroupIdentifier: 'grp_context',
    sortKey: 3,
  },
  {
    identifier: 'ba_coordinates',
    name: L('Koordinaten', 'Coordinates'),
    valueType: 'GeoPoint',
    searchOption: 'NotSearchable',
    propertyGroupIdentifier: 'grp_context',
    sortKey: 4,
  },
  {
    identifier: 'ba_material',
    name: L('Bildträger', 'Medium'),
    valueType: 'List of String',
    listItems: list(MATERIALS),
    propertyGroupIdentifier: 'grp_tech',
    sortKey: 1,
  },
  {
    identifier: 'ba_signature',
    name: L('Bildcode', 'Image code'),
    valueType: 'String',
    propertyGroupIdentifier: 'grp_tech',
    sortKey: 2,
  },
  {
    identifier: 'ba_license',
    name: L('Rechte', 'Rights'),
    valueType: 'List of String',
    listItems: list(LICENSES),
    propertyGroupIdentifier: 'grp_rights',
    sortKey: 1,
  },
  {
    identifier: 'ba_download',
    name: L('Bezug', 'Availability'),
    valueType: 'List of String',
    listItems: list(ORDER),
    propertyGroupIdentifier: 'grp_rights',
    sortKey: 2,
  },
  {
    identifier: 'ba_link',
    name: L('Weitere Informationen', 'Further information'),
    valueType: 'String',
    propertyGroupIdentifier: 'grp_rights',
    sortKey: 3,
  },
  {
    identifier: 'image_width',
    name: L('Breite (px)', 'Width (px)'),
    valueType: 'Integer',
    searchOption: 'NotSearchable',
    propertyGroupIdentifier: 'grp_tech',
    sortKey: 5,
  },
  {
    identifier: 'image_height',
    name: L('Höhe (px)', 'Height (px)'),
    valueType: 'Integer',
    searchOption: 'NotSearchable',
    propertyGroupIdentifier: 'grp_tech',
    sortKey: 6,
  },
  {
    identifier: 'file_name',
    name: L('Dateiname', 'File name'),
    valueType: 'String',
    searchOption: 'NotSearchable',
    propertyGroupIdentifier: 'grp_tech',
    sortKey: 7,
  },
  {
    identifier: 'file_size',
    name: L('Dateigrösse', 'File size'),
    valueType: 'Integer',
    searchOption: 'NotSearchable',
    propertyGroupIdentifier: 'grp_tech',
    sortKey: 8,
  },
];

export const RELATION_TYPES: RawRelationType[] = [
  {
    identifier: 'rel_person',
    name: L('Abgebildete Personen', 'Persons depicted'),
    description: L('Personen, die auf dem Bild zu sehen sind', 'People shown in the image'),
    isUsedForAssetSearch: true,
    status: 'Active',
    displayMode: 'ShowInUi',
    order: 1,
    allowedEntityRelations: [{ fromEntityTypeIdentifier: 'Person', toEntityTypeIdentifier: 'AssetSet' }],
  },
  {
    identifier: 'rel_series',
    name: L('Aus derselben Serie', 'From the same series'),
    isUsedForAssetSearch: false,
    status: 'Active',
    displayMode: 'ShowInUi',
    order: 2,
    allowedEntityRelations: [{ fromEntityTypeIdentifier: 'AssetSet', toEntityTypeIdentifier: 'AssetSet' }],
  },
  {
    identifier: 'ParentChild',
    name: L('Kategorie', 'Category'),
    isSystem: true,
    status: 'Active',
    order: 99,
  },
];

export const PERSONS: Array<[id: string, name: string]> = [
  ['p_aeschbacher', 'Aeschbacher, Ida'],
  ['p_bircher', 'Bircher, Max'],
  ['p_casutt', 'Casutt, Elsa'],
  ['p_dubois', 'Dubois, Henri'],
  ['p_ernst', 'Ernst, Paula'],
  ['p_fischer', 'Fischer, Jakob'],
  ['p_graf', 'Graf, Rosa'],
  ['p_huber', 'Huber, Walter'],
];

interface CategorySpec {
  id: string;
  de: string;
  en: string;
  children?: CategorySpec[];
  scenes?: Scene[];
  description?: string;
}

export const CATEGORY_TREE: CategorySpec = {
  id: 'root',
  de: 'Bildarchiv',
  en: 'Image Archive',
  children: [
    {
      id: 'cat_ansichten',
      de: 'Ansichten der Schweiz',
      en: 'Views of Switzerland',
      description: 'Landschafts- und Ortsansichten aus über hundert Jahren Fotografiegeschichte.',
      children: [
        { id: 'cat_alpen', de: 'Alpen & Gletscher', en: 'Alps & glaciers', scenes: ['alps'] },
        { id: 'cat_seen', de: 'Seen & Flüsse', en: 'Lakes & rivers', scenes: ['lake'] },
        { id: 'cat_staedte', de: 'Städte & Dörfer', en: 'Towns & villages', scenes: ['city'] },
      ],
    },
    {
      id: 'cat_luftbilder',
      de: 'Luftbilder',
      en: 'Aerial photographs',
      description: 'Senkrecht- und Schrägaufnahmen aus der Frühzeit der Luftfahrt.',
      children: [
        { id: 'cat_schraeg', de: 'Schrägaufnahmen', en: 'Oblique views', scenes: ['aerial', 'alps'] },
        { id: 'cat_expeditionen', de: 'Expeditionsflüge', en: 'Expedition flights', scenes: ['aerial'] },
      ],
    },
    {
      id: 'cat_portraets',
      de: 'Porträts',
      en: 'Portraits',
      description: 'Studio- und Gelegenheitsporträts von Forschenden, Studierenden und Angestellten.',
      scenes: ['portrait'],
    },
    {
      id: 'cat_hochschule',
      de: 'Hochschule & Campus',
      en: 'University & campus',
      description: 'Gebäude, Hörsäle und Ereignisse an der Hochschule.',
      children: [
        { id: 'cat_bauten', de: 'Bauten', en: 'Buildings', scenes: ['campus'] },
        { id: 'cat_labore', de: 'Laboratorien', en: 'Laboratories', scenes: ['lab'] },
      ],
    },
    {
      id: 'cat_karten',
      de: 'Ansichtskarten',
      en: 'Postcards',
      description: 'Kolorierte und schwarzweisse Ansichtskarten aus Tourismusorten.',
      scenes: ['postcard'],
    },
  ],
};

export interface FixtureAsset {
  id: string;
  title: string;
  description: string;
  date: string;
  photographer: string;
  location: (typeof LOCATIONS)[number];
  keywords: string[];
  material: string;
  license: string;
  download: string;
  signature: string;
  width: number;
  height: number;
  scene: Scene;
  category: string;
  persons: string[];
  coordinates: [number, number];
}

const SUBJECTS: Record<Scene, string[]> = {
  alps: [
    'Blick auf die Gipfelkette',
    'Gletscherzunge im Abendlicht',
    'Bergsteiger am Grat',
    'Passstrasse im Schnee',
  ],
  lake: [
    'Uferpromenade mit Dampfschiff',
    'Seeufer im Morgennebel',
    'Badeanstalt am See',
    'Brücke über den Fluss',
  ],
  city: [
    'Strassenszene mit Tram',
    'Altstadt und Kirchturm',
    'Marktplatz am Samstag',
    'Bahnhofplatz mit Kutschen',
  ],
  portrait: [
    'Porträt im Atelier',
    'Bildnis einer Forscherin',
    'Studierende vor dem Hörsaal',
    'Porträt mit Hut',
  ],
  aerial: [
    'Luftaufnahme der Felder',
    'Flug über das Mittelland',
    'Senkrechtaufnahme der Siedlung',
    'Flussdelta aus der Luft',
  ],
  lab: [
    'Physikalisches Laboratorium',
    'Messinstrumente im Institut',
    'Versuchsaufbau mit Glaskolben',
    'Sternwarte, Instrumentenraum',
  ],
  campus: [
    'Hauptgebäude, Südfassade',
    'Neubau des Instituts',
    'Lesesaal der Bibliothek',
    'Polyterrasse im Sommer',
  ],
  postcard: ['Gruss aus den Bergen', 'Panorama mit Hotel', 'Seepanorama mit Segelbooten', 'Kurort im Sommer'],
};

const ASPECTS: Array<[number, number]> = [
  [3, 2],
  [3, 2],
  [4, 3],
  [4, 3],
  [2, 3],
  [3, 4],
  [1, 1],
  [16, 9],
  [2, 1],
  [5, 4],
];

function leafCategories(node: CategorySpec, acc: CategorySpec[] = []): CategorySpec[] {
  if (!node.children?.length) {
    if (node.id !== 'root') acc.push(node);
  } else node.children.forEach((child) => leafCategories(child, acc));
  return acc;
}

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

function uuid(r: () => number): string {
  const hex = () => Math.floor(r() * 16).toString(16);
  const part = (n: number) => Array.from({ length: n }, hex).join('');
  return `${part(8)}-${part(4)}-4${part(3)}-a${part(3)}-${part(12)}`;
}

export function buildAssets(count = 120): FixtureAsset[] {
  const r = rng(hashString('epics-demo'));
  const leaves = leafCategories(CATEGORY_TREE);
  const pick = <T>(items: T[]) => items[Math.floor(r() * items.length)];
  const assets: FixtureAsset[] = [];
  for (let i = 0; i < count; i++) {
    const category = leaves[i % leaves.length];
    const scene: Scene = pick<Scene>(category.scenes ?? ['city']);
    const location = pick(LOCATIONS.filter((l) => l[5].includes(scene))) ?? pick(LOCATIONS);
    const year = scene === 'aerial' ? 1919 + Math.floor(r() * 50) : 1864 + Math.floor(r() * 120);
    const [aw, ah] =
      scene === 'portrait' ? pick([[2, 3] as [number, number], [3, 4] as [number, number]]) : pick(ASPECTS);
    const base = 2400 + Math.floor(r() * 2400);
    const width = aw >= ah ? base : Math.round((base * aw) / ah);
    const height = aw >= ah ? Math.round((base * ah) / aw) : base;
    const subject = pick(SUBJECTS[scene]);
    const keywordPool = KEYWORDS.map((k) => k[0]);
    const keywords = [
      ...new Set([
        pick(keywordPool),
        pick(keywordPool),
        scene === 'alps' ? 'kw_gletscher' : pick(keywordPool),
      ]),
    ];
    const material =
      scene === 'postcard'
        ? 'mat_karte'
        : year < 1925
          ? 'mat_glas'
          : year < 1960
            ? pick(['mat_abzug', 'mat_film'])
            : 'mat_dia';
    const date = `${year}-${pad(1 + Math.floor(r() * 12))}-${pad(1 + Math.floor(r() * 28))}`;
    const prefix = {
      alps: 'Ans',
      lake: 'Ans',
      city: 'Ans',
      portrait: 'Portr',
      aerial: 'LBS',
      lab: 'Hs',
      campus: 'Hs',
      postcard: 'PK',
    }[scene];
    assets.push({
      id: uuid(r),
      title: `${location[1]}, ${subject}`,
      description: `${subject} in ${location[1]}. Aufnahme aus dem Jahr ${year}${
        r() > 0.5 ? ', vermutlich im Auftrag eines Verlags' : ''
      }. Die Angaben stammen aus der historischen Beschriftung des Bildträgers.`,
      date,
      photographer: year > 1950 && r() > 0.7 ? 'ph_unbekannt' : pick(PHOTOGRAPHERS.slice(0, 7))[0],
      location,
      keywords,
      material,
      license: year < 1950 ? 'lic_pdm' : pick(['lic_ccbysa', 'lic_reserved']),
      download: r() > 0.9 ? 'dl_order' : 'dl_free',
      signature: `${prefix}_${pad(1000 + i * 37, 5)}`,
      width,
      height,
      scene,
      category: category.id,
      persons: scene === 'portrait' || scene === 'lab' || r() > 0.85 ? [pick(PERSONS)[0]] : [],
      coordinates: [location[3] + (r() - 0.5) * 0.06, location[4] + (r() - 0.5) * 0.09],
    });
  }
  return assets;
}

/** Kategorien als flache Map (id → Spec mit Eltern). */
export function categoryIndex(): Map<string, { spec: CategorySpec; parent?: string }> {
  const index = new Map<string, { spec: CategorySpec; parent?: string }>();
  const walk = (node: CategorySpec, parent?: string) => {
    index.set(node.id, { spec: node, parent });
    node.children?.forEach((child) => walk(child, node.id));
  };
  walk(CATEGORY_TREE);
  return index;
}

export function rawCategory(spec: CategorySpec, thumbnail?: string): RawCategory {
  return {
    identifier: spec.id,
    name: L(spec.de, spec.en),
    hasSubCategories: !!spec.children?.length,
    thumbnailUri: thumbnail ?? null,
  };
}

export function categoryProperties(spec: CategorySpec): RawProperty[] {
  return spec.description
    ? [
        {
          propertyDefinitionIdentifier: 'ba_description',
          propertyValues: [{ propertyValue: [{ value: spec.description }] }],
        },
      ]
    : [];
}

const text = (value: string | number): RawProperty['propertyValues'] => [{ propertyValue: [{ value }] }];
const listValue = (ids: string[]): RawProperty['propertyValues'] =>
  ids.map((id) => ({ propertyListItemIdentifier: id, propertyValue: null }));

export function assetProperties(a: FixtureAsset): RawProperty[] {
  const props: Array<[string, RawProperty['propertyValues']]> = [
    ['ba_title', text(a.title)],
    ['ba_description', text(a.description)],
    ['ba_keywords', listValue(a.keywords)],
    ['ba_date', text(a.date)],
    ['ba_photographer', listValue([a.photographer])],
    ['ba_location', listValue([a.location[0]])],
    ['ba_coordinates', text(`${a.coordinates[0].toFixed(5)},${a.coordinates[1].toFixed(5)}`)],
    ['ba_material', listValue([a.material])],
    ['ba_signature', text(a.signature)],
    ['ba_license', listValue([a.license])],
    ['ba_download', listValue([a.download])],
    ['ba_link', text(`https://www.e-manuscripta.ch/search/quick?query=${encodeURIComponent(a.signature)}`)],
    ['image_width', text(a.width)],
    ['image_height', text(a.height)],
    ['file_name', text(`${a.signature}.tif`)],
    ['file_size', text(Math.round(a.width * a.height * 3 * 1.02))],
  ];
  return props.map(([propertyDefinitionIdentifier, propertyValues]) => ({
    propertyDefinitionIdentifier,
    propertyValues,
  }));
}
