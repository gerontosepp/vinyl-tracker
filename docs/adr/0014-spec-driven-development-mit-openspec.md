# ADR-0014: Spec-Driven Development mit OpenSpec

* **Status:** Accepted
* **Datum:** 2026-10-19
* **Beteiligte:** Architektur- & Entwicklungs-Team
* **Kontextbezug:** Etablierung von strukturierter Spezifikation und KI-gestützter Entwicklung

---

## Kontext & Problemstellung

Mit zunehmender Komplexität des Projekts (Rust Backend, Angular Frontend, nativer MCP-Server, Hardware-Scanner, Roon WebSocket MOO-Integration) wächst das Risiko von Missverständnissen bei der Feature-Entwicklung. Das sogenannte "Vibe Coding" (ungefiltertes Prompting ohne formale Vorab-Spezifikation) führt bei komplexen Domänenregeln – wie der Goldmine-Zustandswertberechnung, Kallax-Collation oder Roon-Playback – häufig zu iterativen Korrekturschleifen und unvollständigen Implementierungen.

Gleichzeitig sind klassische, schwerfällige Product Requirements Documents (PRDs) oder monolithische Pflichtenhefte zu träge für eine agile Entwicklung mit KI-Agenten wie Google Antigravity.

## Entscheidungstreiber

* **Verlässlichkeit**: Anforderungen und Akzeptanzkriterien müssen *vor* dem Schreiben von Produktionscode klar und überprüfbar sein.
* **Agenten-Kompatibilität**: Nahtlose Unterstützung für KI-Assistenten (insb. Google Antigravity, Cursor, Claude Code) ohne Vendor-Lock-in oder Cloud-Zwang.
* **Lebende Spezifikation**: Das System benötigt einen aktuellen, dauerhaften "Source of Truth" (`specs/`), der mit jedem Feature inkrementell per Delta (`changes/`) aktualisiert wird.
* **Harmonisierung mit ADRs**: Klare Trennung zwischen dem *Warum* (Architekturentscheidungen in ADRs) und dem *Was* (funktionale Spezifikationen in OpenSpec).

## Betrachtete Optionen

* **Option 1: Weiterhin nur GitHub Issues & Freitext-Prompts**: Geringer Initialaufwand, aber hohes Risiko von Informationsverlust und unpräziser Feature-Umsetzung.
* **Option 2: GitHub Spec Kit / Kiro**: Leistungsfähig, jedoch oft schwerfälliger und primär auf spezifische Cloud-Tools bzw. größere Teams ausgelegt.
* **Option 3: OpenSpec (`@fission-ai/openspec`)**: Leichtgewichtiges, dateibasiertes Open-Source-Framework für Spec-Driven Development mit nativer Antigravity-Unterstützung, Delta-Änderungen (`changes/`) und lebenden Domänen-Spezifikationen (`specs/`).

## Entscheidung

Wir haben uns für **Option 3: OpenSpec** entschieden.

1. **Native Antigravity-Integration**: OpenSpec generiert vorkonfigurierte Workflows und Skills in `.agents/` (`/opsx-propose`, `/opsx-apply`, `/opsx-archive`), die sich nahtlos in das Antigravity-Ökosystem einfügen.
2. **Klares Schichtenmodell**:
   - `docs/arc42.md`: Globale Systemarchitektur und Qualitätsziele.
   - `docs/adr/`: Architekturentscheidungen und Technologieauswahl (*Warum*).
   - `openspec/specs/`: Fachliche Domänen-Spezifikationen (*Was*).
   - `openspec/changes/`: Inkrementelle Feature-Deltas (`proposal.md`, `specs/`, `tasks.md`).
   - GitHub Issues & PRs: Task-Management, Review und Release-Tracking.
3. **Lokales Tooling**: Einbindung über das Skript `scripts/opsx.sh` bzw. `npx @fission-ai/openspec` ohne externe API-Keys oder Abhängigkeiten.

## Konsequenzen

### Positiv
* **Strukturierte Vorab-Klärung**: Features werden vor der Code-Implementierung über `proposal.md` und `tasks.md` mit dem Entwickler/Benutzer abgestimmt.
* **Verhinderung von Regressionen**: Durch die Pflege von Domänen-Spezifikationen in `openspec/specs/` besitzt das Projekt eine dauerhafte, maschinenlesbare Referenz der Fachlogik.
* **Erhöhte Test- & Implementierungsqualität**: Klare Akzeptanzkriterien erleichtern das Schreiben präziser Unit- und Integrationstests.

### Negativ / Trade-offs
* Zusätzlicher Schritt vor der Implementierung (Erstellung des Proposals und Archivierung beim Abschluss). Für triviale Einzeiler oder reine Tippfehler-Fixes kann dieser Schritt übersprungen werden.

## Technische Umsetzung & Referenzen

* Konfiguration: `openspec/config.yaml`
* CLI-Wrapper: `scripts/opsx.sh`
* Antigravity-Workflows & Skills: `.agents/workflows/`, `.agents/skills/`
* Domänen-Spezifikationen: `openspec/specs/collection/`, `openspec/specs/market-valuation/`, `openspec/specs/scanner/`, `openspec/specs/roon/`, `openspec/specs/mcp/`
* Vorgaben & Workflow: `.agent/rules/documentation_standards.md` und `.agent/skills/ticket-workflow/`
