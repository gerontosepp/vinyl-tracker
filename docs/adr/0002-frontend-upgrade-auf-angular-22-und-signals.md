# ADR-0002: Modernisierung des Frontends auf Angular 22, Signals und Application Builder

* **Status:** Accepted
* **Datum:** 2026-10-18
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#73](https://github.com/gerontosepp/vinyl-tracker/issues/73), Pull Request [#105](https://github.com/gerontosepp/vinyl-tracker/pull/105)

---

## Kontext & Problemstellung

Das Frontend von Vinyl Tracker basierte zuvor auf Angular 19.2 mit einer Mischung aus RxJS-Observables und Zone.js-gestützter Change Detection. Mit der Veröffentlichung von Angular 22 wurden bedeutende Architekturverbesserungen eingeführt:
* Vollwertige Reaktivität über feingranulare Signals (`signal`, `computed`, `effect`) ohne Zone.js-Overhead.
* Neuer Vite-/esbuild-basierter Application Builder (`@angular/build`), der den betagten Webpack-Builder ablöst.
* Strengere Mindestanforderungen an die Laufzeitumgebung (Node.js 24).
* Bessere Unterstützung für Standalone Components ohne `CommonModule`-Ballast.

Es galt zu entscheiden, ob ein direkter Technologiesprung auf Angular 22 vollzogen wird, um moderne Standards für Zustandshaltung und Build-Performance langfristig zu sichern.

## Entscheidungstreiber

* **Reaktivität & Performance:** Vermeidung unkontrollierter Change-Detection-Durchläufe; stattdessen gezielte UI-Aktualisierungen via Angular Signals.
* **Build- & Entwicklungsgeschwindigkeit:** Schnellere HMR (Hot Module Replacement) und optimierte Produktions-Bundles via `@angular/build`.
* **Zukunftssicherheit:** Nutzung modernster TypeScript-Versionen (~6.0) und Standalone Components ohne veraltete Modul-Abstraktionen.
* **Testbarkeit:** Beibehaltung stabiler Karma/Jasmine Unit-Tests (224 Tests) und Playwright E2E-Tests.

## Betrachtete Optionen

* **Option 1: Vollständiges Upgrade auf Angular 22 mit Signals & Node.js 24 (Gewählt)**
  * *Vorteile:* Neueste Sprach- und Framework-Features; zukunftssichere Plattform; spürbar schnellere Build- und Test-Zeiten; nahtlose Signal-Integration.
  * *Nachteile:* Erforderte Anhebung der Node-Version auf Node 24 im gesamten CI/CD- und Docker-Setup; kleinere Breaking Changes in Compiler- und Karma-Konfigurationen.

* **Option 2: Auf Angular 19 verbleiben (Status Quo)**
  * *Vorteile:* Kein akuter Migrationsaufwand.
  * *Nachteile:* Anwachsen technischer Schulden; veraltete Build-Tools; keine Nutzung moderner Signal-Reaktivitätsmuster.

## Entscheidung

Das Frontend wird vollständig auf **Angular 22.2.3** mit **TypeScript ~6.0.3**, **Node.js 24** (`node:24-alpine` in Docker) und dem neuen `@angular/build`-Application-Builder migriert.

Architektur-Leitlinien für das Frontend:
* **Standalone Components:** Alle Komponenten sind `standalone: true`.
* **State Management:** Zustände und abgeleitete Werte werden vorrangig über Signals (`signal()`, `computed()`) verwaltet.
* **Internationalisierung:** Lokalisierung aller UI-Texte über `LanguageService` und `TranslatePipe` (Deutsch & Englisch).
* **Styling:** Tailwind CSS Utility-Klassen mit Dark-Mode-Support; Verzicht auf isoliertes ad-hoc CSS.

## Konsequenzen

### Positive Effekte
* **Schnellere Builds:** Produktions-Bundles werden dank esbuild in unter 5 Sekunden erzeugt.
* **Feingranulare UI-Updates:** Signals reduzieren unnötige DOM-Neurenderings drastisch.
* **Einheitlicher Node 24 Standard:** Sowohl lokale Entwicklung als auch CI-Runner und Docker-Images laufen konsistent auf Node.js 24.
* **100 % Test-Stabilität:** Alle 224 Karma-Unit-Tests und Playwright E2E-Tests laufen fehlerfrei auf Angular 22.
  > **Hinweis (2026-10-19):** Die Unit-Tests laufen inzwischen mit Vitest statt Karma/Jasmine, siehe [ADR-0018](0018-frontend-unit-tests-mit-vitest.md). Die App nutzt weiterhin `zone.js` (`provideZoneChangeDetection`); eine Umstellung auf Zoneless steht noch aus.

### Nachteile & Risiken
* **Node-Kompatibilität:** Ältere Node-Versionen (< 24) werden von Angular 22 nicht mehr unterstützt und müssen im Entwicklungsumfeld aktualisiert werden.
