# Proposal: Sortier-Modus in der unteren Leiste (#187)

## Why

Der breite Button „Sammlung sortieren“ auf der Startseite wirkt am Handy wie ein Fremdkörper, und der schwebende Scan-Button ist größer und anders gestaltet als die übrigen Einträge der unteren Leiste.

## What Changes

- **Untere Leiste (Handy)**: Start, Sammlung, Scannen, Sortieren, Profil – alle Einträge gleich groß und gleich gestaltet. Scannen ist hervorgehoben, solange der Scanner offen ist.
- **Sortieren** bekommt ein eigenes Kallax-Icon (Regal mit 2×2 Fächern und Platten) und öffnet `/sort`.
- **Startseite**: Der Button „Sammlung sortieren“ entfällt.
- Das Icon ist immer sichtbar; ohne Regale zeigt der Sortier-Modus den bestehenden Hinweis, zuerst ein Regal anzulegen.

Nicht im Umfang: Änderungen am Sortier-Modus selbst und an der Desktop-Navigation.

## Capabilities

### Modified Capabilities
- `sort-mode`: Einstieg über die untere Leiste statt über einen Button auf der Startseite.

## Impact

- Frontend: `BottomNavComponent`, `DashboardComponent` (Button und Regal-Abfrage entfallen), Übersetzungen (`nav.sort`).
- Keine Backend-, API- oder MCP-Änderungen.
