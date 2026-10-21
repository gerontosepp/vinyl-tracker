## 1. Backend

- [x] 1.1 `TopArtistDto` in `vinyl-api-types` (camelCase) + Contract-Test
- [x] 1.2 `AnalyticsService::get_top_artists` mit gemeinsamem Zeitraum-Parsing; Route `GET /api/analytics/top-artists`
- [x] 1.3 Integrationstest: Summe über Releases, Release-Anzahl, Reihenfolge der Cover, ohne Interpret ausgeschlossen, Zeitraum, Nutzer-Isolation

## 2. Frontend

- [x] 2.1 Typ `TopArtist`, `ApiService.getTopArtists(from, to)`
- [x] 2.2 `ArtistCollageComponent` (1 / 2 / 3–4 Cover, Platzhalter) + Spec
- [x] 2.3 `TopRecordsComponent`: Tabs „Alben“ | „Interpreten“, Interpreten-Liste (Rang, Collage, Name, Alben, Hördurchgänge, Balken, „Mehr anzeigen“), Ausgabe `openArtist` + Spec
- [x] 2.4 Dashboard: Interpreten im `forkJoin` mit demselben Zeitraum laden, `openArtist` → `/collection?search=…` + Spec
- [x] 2.5 Sammlung übernimmt `search` aus der URL + Spec
- [x] 2.6 Übersetzungen DE/EN

## 3. MCP

- [x] 3.1 Client-Methode und Tool `get_top_artists`, Registrierungstest, Contract-Test

## 4. Doku & Abschluss

- [x] 4.1 README (Dashboard, MCP-Toolanzahl), `mcp/README.md`, arc42 (Endpunkt), Release-Info „Unreleased“
- [x] 4.2 Lokale Qualitätsprüfung: Backend fmt/clippy/Tests/llvm-cov, MCP clippy/Tests, Frontend Tests mit Coverage und Build
