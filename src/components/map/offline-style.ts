import type { StyleSpecification } from 'maplibre-gl';

/**
 * Schlichter Kartenstil ohne externe Kacheln (Demo/Offline): Hintergrund und vereinfachter
 * Landesumriss der Schweiz. Für den Betrieb in der Config einen Vektorstil angeben,
 * z. B. swisstopo: https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json
 */
const SWITZERLAND: Array<[number, number]> = [
  [5.96, 46.14],
  [6.07, 46.47],
  [6.14, 46.6],
  [6.43, 46.78],
  [6.46, 46.95],
  [6.7, 47.04],
  [6.94, 47.23],
  [7.04, 47.37],
  [6.88, 47.36],
  [7.01, 47.49],
  [7.16, 47.48],
  [7.42, 47.44],
  [7.56, 47.58],
  [7.7, 47.54],
  [7.92, 47.55],
  [8.1, 47.56],
  [8.23, 47.62],
  [8.45, 47.57],
  [8.6, 47.8],
  [8.73, 47.72],
  [8.9, 47.66],
  [9.18, 47.66],
  [9.55, 47.53],
  [9.67, 47.38],
  [9.53, 47.27],
  [9.48, 47.1],
  [9.63, 47.05],
  [9.87, 46.94],
  [10.1, 46.85],
  [10.47, 46.96],
  [10.49, 46.62],
  [10.25, 46.62],
  [10.1, 46.42],
  [10.05, 46.23],
  [9.95, 46.38],
  [9.72, 46.3],
  [9.46, 46.48],
  [9.3, 46.5],
  [9.25, 46.25],
  [9.04, 45.84],
  [8.88, 45.97],
  [8.79, 46.1],
  [8.46, 46.24],
  [8.44, 46.46],
  [8.15, 46.3],
  [8.08, 46.11],
  [7.86, 45.92],
  [7.54, 45.98],
  [7.04, 45.93],
  [6.86, 46.08],
  [6.8, 46.43],
  [6.24, 46.31],
  [6.12, 46.25],
  [5.96, 46.14],
];

export function offlineStyle(colors: { bg: string; land: string; line: string }): StyleSpecification {
  return {
    version: 8,
    sources: {
      land: {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [SWITZERLAND] } },
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': colors.bg } },
      { id: 'land', type: 'fill', source: 'land', paint: { 'fill-color': colors.land } },
      { id: 'border', type: 'line', source: 'land', paint: { 'line-color': colors.line, 'line-width': 1.2 } },
    ],
  };
}
