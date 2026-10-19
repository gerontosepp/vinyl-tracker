# Design: Frontend-Unit-Tests von Karma/Jasmine auf Vitest umstellen

## Context
- Angular 22.2.3, `@angular/build` 22.2.3 bringt den Builder `unit-test` (Runner `vitest`) und das Schematic `@schematics/angular:refactor-jasmine-vitest` mit.
- Aktueller Test-Builder: `@angular/build:karma` mit `karma.conf.js` (Coverage-Schwellen 80 % global, Reporter html/text-summary/lcovonly), Polyfills `zone.js` + `zone.js/testing`, umfangreiche `codeCoverageExclude`-Liste.
- CI-Job `frontend-test`: installiert Chrome (`browser-actions/setup-chrome`), führt `npm ci --legacy-peer-deps` und `npm run test -- --watch=false --code-coverage --browsers=ChromeHeadlessCI` aus, danach Playwright-E2E.
- Die App nutzt `provideZoneChangeDetection({ eventCoalescing: true })`.

## Goals / Non-Goals

**Goals:**
- Alle 227 Tests laufen unter Vitest mit identischer Aussagekraft (keine gelöschten oder ausgehöhlten Tests).
- Coverage-Gate ≥ 80 % (alle vier Metriken) bleibt erzwungen, Messbasis unverändert.
- Unit-Tests ohne installierten Browser lauffähig; schneller lokaler Watch-Modus.

**Non-Goals:**
- Zoneless, Änderung der Coverage-Ausschlüsse, Anwendungscode-Änderungen.

## Decisions

1. **Builder `@angular/build:unit-test` statt eigener `vitest.config.ts`**
   Offiziell unterstützter Weg, übernimmt Angular-Compilation, Assets und Polyfills. Eine eigenständige Vitest-Konfiguration (z. B. mit `@analogjs/vitest-angular`) wäre eine zusätzliche Abhängigkeit ohne Mehrwert.

2. **Testumgebung `jsdom`**
   Kein Browser nötig, schnell. Kandidat für Probleme ist die Barcode-Scanner-Komponente (Kamera/`html5-qrcode`); deren Specs mocken die Bibliothek bereits. *Fallback*, falls einzelne Specs echte Browser-APIs brauchen: Vitest-Browser-Modus mit Playwright-Chromium (Schematic `vitest-browser`) – dann für das gesamte Projekt, nicht gemischt.

3. **`zone.js` bleibt vorerst**
   Polyfills `zone.js` und `zone.js/testing` werden im `unit-test`-Builder weiter eingebunden. Damit funktionieren `fakeAsync`/`tick` grundsätzlich weiter; trotzdem werden die drei betroffenen Dateien auf `vi.useFakeTimers()` geprüft, wo das Schematic sie nicht abdeckt.

4. **Migration in zwei Schritten**
   (a) Schematic `refactor-jasmine-vitest` auf alle Specs anwenden, (b) verbleibende Fehler manuell beheben. Jeder Test muss vorher wie nachher dieselbe Aussage prüfen; Testanzahl (227) wird vor/nach verglichen.

5. **Coverage mit `@vitest/coverage-v8`**
   Schwellen 80/80/80/80 und Reporter `html`, `text-summary`, `lcovonly` analog zur bisherigen Karma-Konfiguration; Ausschlüsse 1:1 aus `codeCoverageExclude`. Hinweis: v8- und istanbul-Instrumentierung zählen Branches unterschiedlich – die Prozentwerte können leicht abweichen; das Gate muss trotzdem halten.

6. **`--legacy-peer-deps` entfernen** in `frontend/Dockerfile` (development- und build-Stage) und CI. Nach der Paketumstellung wird `package-lock.json` ohne das Flag neu erzeugt.

7. **CI**
   Schritt „Set up Chrome“ entfernen (Playwright installiert sein eigenes Chromium), Testschritt: `npm run test -- --watch=false --coverage`. Das ADR dokumentiert die Wahl von Vitest und `jsdom`.

8. **Nachtrag aus der Umsetzung**
   - Versionen: `vitest` 5.0.5, `@vitest/coverage-v8` 5.0.5, `jsdom` 30.1.3 (Peer-Range von `@angular/build`: `vitest ^4.0.8 || ^5.0.0`).
   - Das Schematic hat 20 der 29 Spec-Dateien umgeschrieben und dabei auf 4 Leerzeichen eingerückt; die Einrückung wurde auf die Projektkonvention (2, `.editorconfig`) zurückgesetzt, sodass der Diff nur inhaltliche Änderungen zeigt. Alle Spy-Umschreibungen wurden geprüft (Stub bleibt Stub, `and.callThrough()` → `vi.spyOn` ohne Mock).
   - Manuelle Anpassungen: Typ-Casts für Teil-Mocks (`as unknown as MockedObject<T>`), `mockResolvedValue(undefined)`, `fakeAsync`/`tick` → `vi.useFakeTimers()`/`vi.advanceTimersByTimeAsync()` (5 Tests, Zone-ProxyZone existiert unter Vitest nicht), `window.matchMedia` per `vi.stubGlobal` (fehlt in `jsdom`), `localStorage`-Spies auf `Storage.prototype`, SVG-Attributselektoren mit korrekter Schreibweise (`svg[lucideDisc]` statt `svg[lucidedisc]`; `jsdom` vergleicht Attributnamen an SVG-Elementen case-sensitiv).
   - Der Browser-Modus (Decision 2, Fallback) war nicht nötig.

## Risks / Trade-offs
- **[jsdom-Lücken]** Einzelne DOM-/Browser-APIs fehlen in `jsdom` → betroffene Specs mocken oder Fallback Browser-Modus (Decision 2).
- **[Abweichende Coverage-Werte]** Wechsel von istanbul (Karma) zu v8 kann Branch-Coverage verändern → Werte vor/nach dokumentieren; fällt ein Wert unter 80 %, werden fehlende Tests ergänzt statt Schwellen zu senken.
- **[Schematic-Qualität]** Automatische Umschreibung kann Semantik verändern (z. B. `and.returnValue` vs. `mockReturnValue` bei Spies auf Gettern) → vollständiger Review des Diffs.
- **[Lockfile-Änderungen]** Neu erzeugtes `package-lock.json` ohne Legacy-Modus enthält zusätzliche Peer-Einträge → Docker-Build und CI-Lauf als Verifikation.
