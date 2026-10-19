# ADR-0018: Frontend-Unit-Tests mit Vitest statt Karma/Jasmine

* **Status:** Accepted
* **Datum:** 2026-10-19
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#134](https://github.com/gerontosepp/vinyl-tracker/issues/134), OpenSpec-Change `134-frontend-vitest`

---

## Kontext & Problemstellung

Die Angular-Unit-Tests liefen über `@angular/build:karma` mit Jasmine, `karma-coverage` (istanbul) und einem in der CI eigens installierten Chrome. Das Karma-Projekt ist eingestellt; Angular stellt seit Version 21 den Builder `@angular/build:unit-test` mit Vitest als Standard bereit. Zusätzlich installierten Dockerfile und CI die Abhängigkeiten mit `npm ci --legacy-peer-deps`, obwohl kein Peer-Konflikt mehr bestand.

## Entscheidungstreiber

* **Zukunftssicherheit:** Kein abgekündigter Test-Runner im Projekt.
* **Geschwindigkeit & Einfachheit:** Unit-Tests ohne Browser-Installation, schneller Watch-Modus.
* **Gleichwertige Qualitätssicherung:** Gleiche Tests, gleiches 80-%-Coverage-Gate.

## Betrachtete Optionen

* **Option 1: `@angular/build:unit-test` mit Vitest und `jsdom` (Gewählt)**
  * *Vorteile:* Offiziell unterstützter Angular-Weg; Migration der Specs per Schematic `refactor-jasmine-vitest`; kein Browser für Unit-Tests nötig; Coverage-Schwellen direkt in `angular.json`.
  * *Nachteile:* `jsdom` bildet nicht alle Browser-APIs ab (z. B. `matchMedia`) und behandelt Attributnamen an SVG-Elementen spezifikationsgemäß case-sensitiv – einige Specs mussten angepasst werden.

* **Option 2: Vitest im Browser-Modus (Playwright-Chromium)**
  * *Vorteile:* Echte Browser-Umgebung.
  * *Nachteile:* Langsamer, Browser-Abhängigkeit bleibt; für die vorhandenen Specs nicht nötig. Bleibt Fallback, falls künftige Tests echte Browser-APIs brauchen.

* **Option 3: Bei Karma/Jasmine bleiben**
  * *Nachteile:* Abgekündigt, kein Weiterentwicklungspfad.

## Entscheidung

* Test-Builder `@angular/build:unit-test` (Runner `vitest`, Umgebung `jsdom`); `karma.conf.js` entfällt. `zone.js/testing` wird vom Builder automatisch eingebunden, solange die App `zone.js` nutzt.
* Specs nutzen Vitest-APIs (`vi.fn`, `vi.spyOn`, Fake-Timer statt `fakeAsync`/`tick`).
* Coverage über `@vitest/coverage-v8`, Schwellen 80 % für Statements, Branches, Functions und Lines in `angular.json`; Ausschlüsse unverändert übernommen.
* `npm ci` ohne `--legacy-peer-deps`; die CI installiert für Unit-Tests keinen Chrome mehr.

## Konsequenzen

### Positive Effekte
* Unit-Tests laufen ohne Browser in wenigen Sekunden; die CI spart den Chrome-Setup-Schritt.
* Peer-Dependency-Konflikte werden künftig wieder sichtbar statt verdeckt.

### Nachteile & Risiken
* **Andere Coverage-Zählung:** v8 zählt anders als istanbul (z. B. 364 statt 289 Zeilen bei identischen Ausschlüssen); Prozentwerte sind nicht 1:1 mit der Karma-Ära vergleichbar.
* **jsdom-Grenzen:** Browser-APIs, die `jsdom` nicht kennt, müssen in Specs gestubbt werden (`vi.stubGlobal`).
