# Proposal: Hilfe in der App (#247)

## Why

Die App hat keine eingebaute Hilfe: Symbol-Buttons erklären sich nicht, und Funktionen wie Label-Erkennung, Regale oder Sortiermodus sind nur in der README beschrieben.

## What Changes

- **Tooltips:** Directive `[appTooltip]` für Buttons, Links und Badges (Hover, Tastatur-Fokus, langes Drücken am Handy, `aria-describedby`/`aria-label`); ersetzt die Browser-`title`-Tooltips an Bedienelementen.
- **Hilfeseite `/help`:** erklärt alle Funktionen, mit Inhaltsverzeichnis (am Handy aufklappbar) und Suche; erreichbar über einen eigenen Button in der Seitenleiste und das ?-Symbol in der oberen Leiste am Handy.
- **Inhalt als Markdown:** `docs/Help.md` (de) und `docs/Help.en.md` (en), per `scripts/sync-help.js` in `frontend/public/assets/help.<lang>.json` übertragen; der Claude-Hook regeneriert nach jeder Änderung.
- **Kontext-Hilfe:** ?-Symbol auf Scan, Sammlung, Regalen, Label-Inbox, Sortiermodus und Einstellungen springt zum passenden Abschnitt.
- **Prozess:** `ticket-workflow` und Dokumentationsregeln verlangen, die Hilfe bei jedem sichtbaren Feature zu pflegen.

## Capabilities

### New Capabilities
- `help`: Hilfeseite, Kontext-Hilfe und Tooltips.

## Impact

- Frontend: `TooltipDirective`, `HelpComponent`, `HelpLinkComponent`, Sidebar, Top-Menü, Umstellung der `title`-Attribute, Übersetzungen.
- Skripte/Doku: `scripts/sync-help.js`, Hook, `docs/Help*.md`, README, arc42, Workflow-Regeln.
