# Proposal: Meistgespielte Interpreten auf der Startseite (#178)

## Why

Die Startseite zeigt die meistgespielten Alben. Wer viel von einer Band hört, aber über mehrere Alben verteilt, taucht dort kaum auf. Eine Rangliste der Interpreten zeigt, wen der Nutzer tatsächlich am meisten hört, und führt mit einem Klick zu allen seinen Platten in der Sammlung.

## What Changes

- **Tabs im Block „Meistgespielte Alben“**: „Alben“ | „Interpreten“. Der Zeitraum-Filter (Alle, 7 Tage, Heute, eigener Zeitraum) gilt für beide Tabs.
- **Interpreten-Rangliste**: die 10 Interpreten mit den meisten Hördurchgängen im Zeitraum, mit Rang, Anzahl der Hördurchgänge und Anzahl der gehörten Alben, im Stil der Alben-Liste (Fortschrittsbalken, Medaillen für Platz 1–3, „Mehr anzeigen“ ab 5).
- **Cover-Collage** als Bild: bis zu 4 Cover der meistgehörten Platten/CDs des Interpreten (1 Cover vollflächig, 2 nebeneinander, 3–4 als 2×2).
- **Klick auf einen Interpreten** öffnet die Sammlung mit der Suche nach dem Interpreten.
- **Sammlung**: übernimmt eine Suche aus der URL (`/collection?search=…`).
- **API**: `GET /api/analytics/top-artists?from&to`.
- **MCP**: neues Tool `get_top_artists`.

Nicht im Umfang: Zusammenführen von Schreibweisen („The Beatles“ / „Beatles“) oder von Kollaborationen, Künstler-Seite, Künstlerfotos von Discogs.

## Capabilities

### New Capabilities
- `listening-statistics`: Hörstatistiken der Startseite; hier zunächst die meistgespielten Interpreten (Rangliste, Collage, Klick in die Sammlung, API, MCP).

### Modified Capabilities
- `mcp`: neues Tool `get_top_artists`.

## Impact

- **Backend**: `analytics_service::get_top_artists`, Route `/api/analytics/top-artists`, DTO `TopArtistDto` in `vinyl-api-types`, Integrationstest.
- **Frontend**: `TopRecordsComponent` mit Tabs und Interpreten-Liste, Collage, `ApiService.getTopArtists`, Dashboard lädt die Interpreten mit demselben Zeitraum, `CollectionComponent` liest `search` aus der URL, Übersetzungen DE/EN, Specs.
- **MCP**: Tool `get_top_artists`, Client-Methode, Contract-Test, `mcp/README.md`.
- **Doku**: README, Release-Info. Keine Migration.
