# Proposal: Frontend-Unit-Tests von Karma/Jasmine auf Vitest umstellen (#134)

## Why
- **Karma ist abgekündigt.** Das Karma-Projekt ist eingestellt; Angular hat Vitest mit dem Builder `@angular/build:unit-test` zum Standard gemacht. Das Projekt nutzt bereits Angular 22, hängt beim Test-Runner aber an der alten Kette (`karma`, `karma-jasmine`, `karma-chrome-launcher`, `karma-coverage`, `karma-jasmine-html-reporter`, `jasmine-core`, `@types/jasmine`, `istanbul-lib-instrument`).
- **Unnötiger Workaround `--legacy-peer-deps`:** `npm ci` und `npm install` laufen inzwischen ohne Peer-Dependency-Konflikt (geprüft mit einer Kopie von `package.json`/`package-lock.json`). Das Flag in `frontend/Dockerfile` (2×) und der CI würde künftige echte Konflikte verdecken.
- **Chrome-Abhängigkeit der Unit-Tests:** Die CI installiert eigens Chrome für Karma. Vitest mit `jsdom` braucht für Unit-Tests keinen Browser (Playwright-E2E-Tests bleiben unverändert).

Ausgangslage (lokal gemessen): 29 Spec-Dateien, 227 Tests grün, 131 Jasmine-Spy-Aufrufe, 13 weitere Jasmine-spezifische APIs (`createSpyObj`, `jasmine.any` …), 3 Dateien mit `fakeAsync`/`tick`.

## What Changes
- **Test-Runner:** `angular.json` → Builder `@angular/build:unit-test` mit Runner `vitest` und Umgebung `jsdom`; `karma.conf.js` entfällt.
- **Spec-Migration:** Automatisch per Angular-Schematic `refactor-jasmine-vitest` (`spyOn` → `vi.spyOn`, `jasmine.createSpyObj` → Objekte mit `vi.fn()`, Matcher), danach manuelle Nacharbeit, v. a. `fakeAsync`/`tick` (→ `vi.useFakeTimers()`).
- **Coverage-Gate:** Weiterhin ≥ 80 % für Statements, Branches, Functions und Lines; die bestehende Ausschlussliste (`codeCoverageExclude`) wird **unverändert** übernommen.
- **Abhängigkeiten:** Karma-/Jasmine-Pakete entfernen, `vitest`, `jsdom` und `@vitest/coverage-v8` hinzufügen; `--legacy-peer-deps` aus Dockerfile und CI entfernen.
- **CI:** Schritt „Run Karma Unit Tests“ → Vitest; der Schritt „Set up Chrome“ entfällt, sofern nichts anderes Chrome benötigt (Playwright bringt eigenes Chromium mit).
- **Regeln & Doku:** `.agent/rules/quality_standards.md` (Vitest statt Karma/Jasmine), README, `frontend/README.md`, `docs/CLAUDE.md`, arc42; neues ADR (Wahl des Test-Frameworks).

## Capabilities

### New Capabilities
*(Keine – reine Tooling-Umstellung)*

### Modified Capabilities
*(Keine Spezifikations-Deltas; `skip_specs: true`)*

## Impact
- `frontend/angular.json`, `frontend/package.json`, `frontend/package-lock.json`, `frontend/karma.conf.js` (entfernt), `frontend/tsconfig.spec.json`, 29 Spec-Dateien, `frontend/Dockerfile`, `.github/workflows/ci.yml`, Doku/Regeln.
- **Kein Einfluss** auf Anwendungscode, Backend, MCP oder E2E-Tests.

## Out of Scope
- **Zoneless Change Detection** (Entfernen von `zone.js`). Nur 7 der 22 Komponenten/Dateien mit Komponentenlogik nutzen Signals; der Rest verlässt sich auf Zone-basierte Change Detection (Subscriptions, die Felder setzen). Eine Umstellung ändert Laufzeitverhalten und braucht E2E-Verifikation → eigener Change. Vitest läuft vorerst weiter mit `zone.js/testing`, damit bestehende Tests unverändert gültig bleiben.
- **Coverage-Ausschlüsse:** Die Ausschlussliste klammert u. a. `src/app/features/**` aus, das 80-%-Gate misst derzeit nur 289 Zeilen. Das wird in Punkt 8 (Frontend-Testabdeckung) behandelt.
- Eigene i18n-Lösung (`language.service.ts`, Punkt 9).
