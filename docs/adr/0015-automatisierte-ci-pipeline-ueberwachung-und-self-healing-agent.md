# ADR-0015: Automatisierte CI-Pipeline-Überwachung und Self-Healing-Agent

* **Status:** Accepted
* **Datum:** 2026-10-19
* **Beteiligte:** Architektur- & Entwicklungs-Team
* **Kontextbezug:** GitHub Actions CI-Stabilität, Triage & Entwicklungs-Geschwindigkeit

---

## Kontext & Problemstellung

Im Rahmen der CI/CD-Pipeline von Vinyl Tracker werden für jeden Push und Pull Request aufwendige Testsuiten ausgeführt:
- Backend: Rust `cargo fmt`, `cargo check`, `cargo clippy`, PostgreSQL-Integrations- und Unit-Tests sowie Testabdeckungsprüfung (`cargo-llvm-cov >= 80%`).
- Frontend: Karma/Jasmine Unit-Tests, Playwright E2E-Tests, Production-Build (`ng build`).
- MCP: Rust Model Context Protocol Tool-Tests.
- Container: Multi-Architektur Docker Builds.

Treten bei Pushes oder Merges sporadische oder unerwartete Pipeline-Fehlschläge auf (z. B. vergessene Linter-Warnungen, Formatierungsdifferenzen, gebrochene Mocks oder unzureichende Testabdeckung), müssen Entwickler häufig manuell die GitHub Actions Web-Oberfläche öffnen, Logs durchsuchen, den Branch wechseln, den Fehler lokal nachstellen und einen Fix-Commit nachschieben.

Dieser manuelle Prozess bindet wertvolle Entwicklerzeit und verzögert das Mergen von Feature-Branches.

## Entscheidungstreiber

* **Reaktionszeit**: Fehlschläge in der CI müssen sofort erkannt und strukturiert analysiert werden, ohne manuelles Aufrufen der Web-UI.
* **Autonome Triage**: Häufige, deterministische Fehler (z. B. Formatierung, Clippy-Warnungen, Test-Mocks, fehlende Test-Cases für Coverage-Schwellenwerte) sollen automatisch behoben und verifiziert werden.
* **Werkzeug-Integration**: Nutzung vorhandener Werkzeuge (GitHub CLI `gh`, Antigravity Skills & Scheduler).

## Betrachtete Optionen

* **Option 1: Rein manueller Prozess**: Entwickler überwachen die Pipeline selbst in der Web-Oberfläche. Geringer Setup-Aufwand, aber hohe manuelle Rüstzeit und Unterbrechung des Arbeitsflusses.
* **Option 2: Schwerfällige Bot-Infrastruktur (externe Cloud-Services)**: Drittanbieter-Bots, die Schreibzugriff auf das Repository verlangen. Erzeugt Sicherheits- und Wartungsrisiken sowie Kosten.
* **Option 3: Lokaler / integrierter Self-Healing Agent**: Kombination aus einem Watchdog-CLI-Skript (`scripts/watch_pipeline.sh`), einem spezialisierten Antigravity-Skill (`.agent/skills/pipeline-healer/`) und einem Hintergrund-Scheduler.

## Entscheidung

Wir haben uns für **Option 3: Self-Healing Agent mit GitHub CLI & Antigravity** entschieden.

1. **Watchdog & Triage-Skript ([scripts/watch_pipeline.sh](file:///Users/opolm/develop/AntiGrafity/scripts/watch_pipeline.sh))**:
   - Fragt über die GitHub CLI (`gh run list`) regelmäßig den Pipeline-Status ab.
   - Extrahiert bei Fehlschlägen automatisch die fehlerhaften Step-Logs (`gh run view <ID> --log-failed`).
   - Bietet interaktive Modi (`--watch`, `--heal [ID]`) und System-Benachrichtigungen.
2. **Standardisierter Reparatur-Skill ([.agent/skills/pipeline-healer/SKILL.md](file:///Users/opolm/develop/AntiGrafity/.agent/skills/pipeline-healer/SKILL.md))**:
   - Definiert deterministische Klassifikations- und Behebungsstrategien für jede Job-Kategorie (Rust Formatting, Clippy, Tests, Coverage, Angular Karma, Build).
   - Erzwingt lokale Verifikation vor dem Push (0 Fehler, 0 Warnungen).
3. **Automatisierte Hintergrundüberwachung**:
   - Ermöglicht dem Antigravity-Agenten über Cron-Schedules (`schedule`) oder Watchdog-Trigger, fehlgeschlagene Runs selbstständig zu reparieren.

## Konsequenzen

### Positiv
* **Minimale Downtime**: Broken Builds werden unmittelbar erkannt und ohne manuelle Log-Suche direkt am betroffenen Code repariert.
* **Erhaltung der Qualitätsstandards**: Linter- und Coverage-Vorgaben (ADR-0006) werden durch den Agenten automatisch eingehalten und nachgezogen.
* **Keine externen Abhängigkeiten**: Arbeitet ausschließlich lokal mit `gh`, Git und den bereits im Projekt vorhandenen Test-Runnern.

### Negativ / Trade-offs
* Bei komplexen, logischen Fehlern (z. B. unklare fachliche Anforderung oder defekte externe Discogs-API) kann der Agent den Fehler nicht immer ohne Rücksprache mit dem Entwickler lösen; in diesem Fall liefert er eine fundierte Fehleranalyse und bittet um Klärung.

## Technische Umsetzung & Referenzen

* Skill: `.agent/skills/pipeline-healer/SKILL.md`
* Skript: `scripts/watch_pipeline.sh`
* CI-Workflow: `.github/workflows/ci.yml`
