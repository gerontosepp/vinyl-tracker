# Tasks

## 1. Baseline

- [x] 1.1 Karma-Lauf dokumentieren: Testanzahl (227) und Coverage (Statements/Branches/Functions/Lines)
  *Karma:* 227 Tests; Statements 95,55 %, Branches 83,33 %, Functions 94,11 %, Lines 97,57 % (289 Zeilen)

## 2. Umstellung des Test-Runners

- [x] 2.1 Schematic `refactor-jasmine-vitest` ausführen und Diff vollständig reviewen
- [x] 2.2 `angular.json`: Test-Builder auf `@angular/build:unit-test` (Runner `vitest`, `jsdom`), Polyfills `zone.js`/`zone.js/testing`, Coverage-Schwellen 80 % und Ausschlüsse 1:1 übernehmen
- [x] 2.3 `karma.conf.js` löschen, `tsconfig.spec.json` auf Vitest-Typen umstellen
- [x] 2.4 Abhängigkeiten: Karma-/Jasmine-Pakete entfernen, `vitest`, `jsdom`, `@vitest/coverage-v8` hinzufügen; `package-lock.json` ohne `--legacy-peer-deps` neu erzeugen
- [x] 2.5 Verbleibende Fehler manuell beheben (insb. `fakeAsync`/`tick`-Specs, Spy-Semantik)

## 3. Verifikation

- [x] 3.1 `npm test -- --watch=false --coverage`: 227 Tests grün, alle Coverage-Werte ≥ 80 %, Vergleich mit Baseline dokumentieren
  *Vitest:* 227 Tests; Statements 91,35 %, Branches 86,59 %, Functions 90,9 %, Lines 93,13 % (364 Zeilen, v8-Zählung). Gate geprüft: mit Schwelle 99 % bricht der Lauf mit Exit-Code 1 ab.
- [x] 3.2 `npm run build` fehlerfrei
- [x] 3.3 Docker-Build des Frontends (development- und production-Target) ohne `--legacy-peer-deps`
- [x] 3.4 Playwright-E2E lokal unverändert grün
  *Ergebnis:* 12/12 grün.

## 4. CI & Build

- [x] 4.1 `frontend/Dockerfile`: `--legacy-peer-deps` entfernen (2×)
- [x] 4.2 `.github/workflows/ci.yml`: `npm ci` ohne Flag, Testschritt auf Vitest, Schritt „Set up Chrome“ entfernen, falls nicht mehr benötigt

## 5. Dokumentation & Regeln

- [x] 5.1 ADR „Frontend-Unit-Tests mit Vitest“ anlegen, ADR-Index und arc42 Abschnitt 9 aktualisieren; ADR-0002 um Hinweis ergänzen
- [x] 5.2 `.agent/rules/quality_standards.md`, README, `frontend/README.md`, `docs/CLAUDE.md`, arc42 (Qualitätsanforderungen) auf Vitest aktualisieren
- [x] 5.3 `docs/Release-Info.md` unter „Unreleased“, `node scripts/sync-release-info.js`
