# Konfiguration (`config.json`)

Die App liest beim Start `config/config.json` (relativ zur App). Fehlt die Datei, startet sie mit
`config/config.example.json` im Demo-Modus. Alle Werte sind optional, die Vorgaben stehen in
[`src/config/defaults.ts`](../src/config/defaults.ts). Objekte werden tief zusammengeführt, Arrays ersetzt.
Eine ungültige Konfiguration wird beim Start mit Pfad und Grund angezeigt.

**Lokalisierte Texte** (`Localized`) sind entweder ein String oder ein Objekt je Sprache:
`{ "de": "Sammlung", "en": "Collection" }`.

> Die Datei wird ausgeliefert und ist damit öffentlich. Sie darf nur den **öffentlichen Gast-Token**
> enthalten, nie Zugangsdaten eines Benutzers. `config.json` ist in `.gitignore` eingetragen.

## `api` – Zugang zu Sharedien

| Schlüssel           | Typ               | Vorgabe | Bedeutung                                                                                          |
| ------------------- | ----------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `baseUrl`           | string            | –       | Basis-URL der Sharedien-Instanz (ohne `/api/v13`). Pflicht ausser im Demo-Modus.                   |
| `version`           | string            | `v13`   | API-Version im Pfad.                                                                               |
| `token`             | string            | –       | Öffentlicher Gast-Token (Bearer).                                                                  |
| `tokenUrl`          | string            | –       | Optional: URL, die `{ "access_token": "…" }` liefert. Wird bei Start und nach HTTP 401 abgefragt.  |
| `browserIdentifier` | string            | –       | Wird bei Suchen als `browserIdentifier` mitgesendet (Katalog-/Browser-Einschränkung in Sharedien). |
| `mock`              | boolean           | `false` | Demo-Modus mit Beispieldaten, ohne Netz.                                                           |
| `zipMode`           | `form` \| `fetch` | `form`  | ZIP-Download per Formular-POST (Streaming, Standard) oder per `fetch` (nur Demo/Tests).            |

Voraussetzung: Sharedien muss die Origin der App per CORS zulassen.

## `catalog`

| Schlüssel             | Typ       | Vorgabe | Bedeutung                                                                                                                                                                                  |
| --------------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `title`, `subtitle`   | Localized | –       | Titel und Untertitel (Startseite, Seitentitel).                                                                                                                                            |
| `rootCategory`        | string    | `root`  | Wurzel des Kategoriebaums.                                                                                                                                                                 |
| `pageSize`            | 10–200    | `60`    | Treffer pro Nachladen.                                                                                                                                                                     |
| `recursiveCategories` | boolean   | `true`  | Kategorienfilter schliesst Unterkategorien ein.                                                                                                                                            |
| `fixedFilters`        | Array     | `[]`    | Feste Einschränkungen jeder Suche, z. B. `{ "source": "categories", "value": "<id>" }`, `{ "source": "<feld>", "op": "HasValue" }` oder `{ "source": "<feld>", "value": "<listItemId>" }`. |

## `locales`

`ui` (Sprachen der Oberfläche, mitgeliefert: `de`, `en`), `default`, `dataFallback` (Datensprache,
wenn ein Feld in der gewählten Sprache leer ist). Die Datensprache wird per `X-Data-Languages`
angefragt.

## `search`

| Schlüssel     | Bedeutung                                                                      |
| ------------- | ------------------------------------------------------------------------------ |
| `sortOptions` | `[{ "id": "relevance" \| "<feld>_asc" \| "<feld>_desc", "label": Localized }]` |
| `defaultSort` | ID der Standardsortierung.                                                     |
| `historySize` | Anzahl gespeicherter Suchbegriffe (0 = aus).                                   |
| `suggestions` | Vorschläge beim Tippen (`assets/quicksearch`).                                 |
| `aiSearch`    | `auto` (anzeigen, wenn Sharedien `similarSearch` aktiviert hat) oder `off`.    |
| `defaultView` | `justified` (Galerie), `grid` (Raster) oder `list` (Tabelle).                  |

## `filters` und `addableFilters`

Reihenfolge = Reihenfolge im Filterpanel.

```json
[
  { "type": "category", "label": { "de": "Sammlung", "en": "Collection" }, "open": true },
  { "type": "date", "source": "ba_date", "decades": [1860, 1990], "open": true },
  { "type": "facet", "source": "ba_photographer", "open": true },
  { "type": "facet", "source": "ba_license", "radio": true },
  { "type": "relation", "source": "rel_person", "valueType": "Person" },
  { "type": "text", "source": "ba_signature", "operation": "Contains" }
]
```

- `facet`: Listenfeld mit Trefferzahlen (Sharedien-Facetten). `radio: true` für Einzelauswahl.
- `relation`: Relationstyp (z. B. Personen); `valueType` = Entitätstyp der Werte.
- `date`: Zeitraum; `decades` begrenzt Regler und Jahrzehnt-Schnellwahl.
- `text`: Freitext mit Bedingung (`Contains`, `DoesNotContain`, `Equals`, `NotEquals`, `FuzzyContains`, `FuzzyEquals`).
- `category`: Drill-down durch den Kategoriebaum mit Suche.

`addableFilters: true` bietet zusätzlich alle durchsuchbaren Felder unter «Filter hinzufügen» an.

## `fields` – Bedeutung von Sharedien-Feldern

`title`, `date`, `creator`, `width`, `height` (für das Galerie-Layout), `license`, `coordinates`
(«lat,lng», für Karte und Geo-Filter), `signature` (Bildcode). Werte sind
property-definition-Identifier aus Sharedien.

## `results`

`tableColumns`: Spalten der Listenansicht, z. B. `[{ "field": "ba_signature" }, { "field": "ba_date" }]`.
Ist für ein Feld eine Sortierung `<feld>_asc|_desc` definiert, ist die Spalte sortierbar.

## `detail`

| Schlüssel         | Bedeutung                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `foldedGroups`    | Property-Gruppen, die standardmässig zugeklappt sind.                                     |
| `hiddenFields`    | Felder, die in der Detailansicht nicht erscheinen.                                        |
| `drillDownFields` | Felder, deren Werte als Suchlinks erscheinen.                                             |
| `relations`       | Relationstypen für «Verwandte Bilder».                                                    |
| `categoryRoot`    | Wurzel für die Anzeige der Kategoriepfade (Vorgabe: `catalog.rootCategory`).              |
| `reportIssue`     | `{ "mode": "mailto" \| "url", "target": "…", "subject": Localized }` für «Fehler melden». |

## `download`

| Schlüssel            | Bedeutung                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `previewFormat`      | Derivat für die Detailansicht (Vorgabe `Screen`).                                                    |
| `zoomFormat`         | Derivat für Deep Zoom (sonst `Print`, dann `Screen`).                                                |
| `showPreviewFormats` | Vorschau-Derivate, die trotzdem zum Download angeboten werden.                                       |
| `restriction`        | `{ "field": "<feld>", "value": "<listItemId>" }` – solche Bilder sind nur auf Bestellung erhältlich. |
| `order`              | Bestellweg für gesperrte Bilder (`mailto` oder `url`, wie `reportIssue`).                            |

## `basket` – Auswahl

`enabled`, `max` (Anzahl Bilder), `termsOfUse` (`off` \| `show` \| `require`), `termsText`,
`clearAfterDownload`, `defaultFormat` (Derivat für den ZIP-Download).

## `export`

`fields` (Spalten der CSV-Datei, leer = alle sichtbaren Felder) und `delimiter` (`;` oder `,`).
Der Export läuft im Browser und braucht keine Export-Berechtigung in Sharedien.

## `compare`

`enabled`: Vergleich zweier ausgewählter Bilder.

## `map`

| Schlüssel                     | Bedeutung                                                                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                     | Karte anzeigen (zusätzlich muss `fields.coordinates` gesetzt sein).                                                                    |
| `styles.light`, `styles.dark` | MapLibre-Stil-URLs. `offline` = schlichter Stil ohne Kacheln. Fehlt `dark`, wird der helle Stil im Dunkelmodus per Filter abgedunkelt. |
| `center`, `zoom`              | Startansicht `[lat, lng]`.                                                                                                             |
| `maxMarkers`                  | Obergrenze der Marker (es werden so viele Treffer seitenweise geladen).                                                                |
| `attribution`                 | Zusätzlicher Quellenvermerk.                                                                                                           |

Beispiel swisstopo (Vektorkacheln, Nutzungsbedingungen beachten):
`"light": "https://vectortiles.geo.admin.ch/styles/ch.swisstopo.lightbasemap.vt/style.json"`.

## `home` – Startseite

`heroAssets` (Asset-IDs für die Bildcollage, sonst die ersten Treffer), `featuredCategories`
(Sammlungen im Raster, sonst die erste Ebene), `discoverQueries` (Suchbegriffe für die
«Entdecken»-Streifen), `stats` (`[{ "value": "1,3 Mio.", "label": Localized }]`).

## `analytics.matomo`

`enabled`, `url` (z. B. `https://library-ethz.opsone-analytics.ch/`), `siteId`. Erfasst werden
Seitenaufrufe (auch bei Navigation innerhalb der App), Suchbegriffe (Site Search), externe Links
und Downloads.

## `branding`

`name`, `owner`, `logo` (Bild-URL), `footerText`, `links` (`[{ "label": Localized, "href": "…" }]`).

## `theme` – Farbthemes

```json
{
  "active": "eth-blau",
  "radiusScale": 1,
  "fonts": { "display": "Instrument Serif", "ui": "Inter Variable" },
  "themes": {
    "mein-theme": {
      "label": "Mein Theme",
      "light": {
        "accent": "#215CAF",
        "bg": "#FAF9F6",
        "surface": "#FFFFFF",
        "text": "#17171A",
        "muted": "#5E5E66"
      },
      "dark": {
        "accent": "#8DB1EE",
        "bg": "#0E0E10",
        "surface": "#161619",
        "text": "#F2F0EB",
        "muted": "#A3A2A8"
      }
    }
  }
}
```

Mitgeliefert: `eth-blau`, `petrol`, `bronze`, `graphit`. Optional je Schema: `raised`, `border`.
Aus diesen Werten werden alle Design-Tokens (auch die von Web Awesome) abgeleitet. Benutzer
wählen Hell, Dunkel oder System; das Farbtheme bestimmt der Betreiber.

`npm run check:themes` (läuft auch bei `npm run build`) prüft alle Themes auf WCAG-AA-Kontraste.
Eigene Schriften müssen als Webfont eingebunden werden (z. B. in `src/styles/global.css`).
