## 1. Backend

- [x] 1.1 `LayoutItem.thumb_url` und `rc.thumb_url` in der `items`-Abfrage
- [x] 1.2 DTOs `StorageSequenceItemDto`, `StorageSequenceDto` in `vinyl-api-types` (camelCase) + Contract-Test
- [x] 1.3 `StorageService::sequence(user, media)` und Route `GET /api/storage/sequence?media=` (400 bei ungültigem Medium, leere Liste ohne Regale)
- [x] 1.4 Integrationstest: Reihenfolge = Übersicht, Lagerplatz je Exemplar, Exemplare ohne Platz am Ende, leere Liste ohne Regale, 400

## 2. Frontend

- [x] 2.1 Typen und `ApiService.getStorageSequence(media)`
- [x] 2.2 `WakeLockService` (anfordern, bei Sichtbarkeit erneut, freigeben; still ohne Unterstützung) + Spec
- [x] 2.3 `SortModeComponent` unter `features/sort-mode/`, Route `/sort` ohne `app-layout`: Start-Screen (Regal, Zeile, Spalte mit Validierung), Sortier-Screen (Cover, Titel, Interpret, Fach, „x / n“, Hinweis „Neues Fach“, Weiter/Zurück/Beenden), Abschluss-Screen; Vorladen des nächsten Covers
- [x] 2.4 Startindex, Fortschritt im Fach und Fachwechsel als reine Funktionen + Specs (leeres Startfach, Regalwechsel, ohne Platz)
- [x] 2.5 Button „Sortieren“ auf der Startseite (`md:hidden`, nur mit Regalen) + Spec
- [x] 2.6 Übersetzungen DE/EN

## 3. Doku & Abschluss

- [x] 3.1 README (User Guide „Sortier-Modus“), arc42 (Route `/sort`, Endpunkt, Laufzeitszenario), Release-Info „Unreleased“
- [x] 3.2 Lokale Qualitätsprüfung: Backend fmt/clippy/Tests/llvm-cov, MCP-Tests, Frontend Tests mit Coverage und Build
