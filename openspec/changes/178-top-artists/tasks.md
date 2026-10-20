## 1. Backend

- [ ] 1.1 `TopArtistDto` in `vinyl-api-types` (camelCase) + Contract-Test
- [ ] 1.2 `AnalyticsService::get_top_artists` mit gemeinsamem Zeitraum-Parsing; Route `GET /api/analytics/top-artists`
- [ ] 1.3 Integrationstest: Summe über Releases, Release-Anzahl, Reihenfolge der Cover, ohne Interpret ausgeschlossen, Zeitraum, Nutzer-Isolation

## 2. Frontend

- [ ] 2.1 Typ `TopArtist`, `ApiService.getTopArtists(from, to)`
- [ ] 2.2 `ArtistCollageComponent` (1 / 2 / 3–4 Cover, Platzhalter) + Spec
- [ ] 2.3 `TopRecordsComponent`: Tabs „Alben“ | „Interpreten“, Interpreten-Liste (Rang, Collage, Name, Alben, Hördurchgänge, Balken, „Mehr anzeigen“), Ausgabe `openArtist` + Spec
- [ ] 2.4 Dashboard: Interpreten im `forkJoin` mit demselben Zeitraum laden, `openArtist` → `/collection?search=…` + Spec
- [ ] 2.5 Sammlung übernimmt `search` aus der URL + Spec
- [ ] 2.6 Übersetzungen DE/EN

## 3. MCP

- [ ] 3.1 Client-Methode und Tool `get_top_artists`, Registrierungstest, Contract-Test

## 4. Doku & Abschluss

- [ ] 4.1 README (Dashboard, MCP-Toolanzahl), `mcp/README.md`, arc42 (Endpunkt), Release-Info „Unreleased“
- [ ] 4.2 Lokale Qualitätsprüfung: Backend fmt/clippy/Tests/llvm-cov, MCP clippy/Tests, Frontend Tests mit Coverage und Build
