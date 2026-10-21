## REMOVED Requirements

### Requirement: Sortier-Modus starten
**Reason**: Der Einstieg über einen Button auf der Startseite entfällt.
**Migration**: Ersetzt durch „Sortier-Modus über die untere Leiste starten“.

## ADDED Requirements

### Requirement: Sortier-Modus über die untere Leiste starten
Die untere Navigationsleiste der Mobil-Ansicht MUST einen Eintrag „Sortieren“ mit Regal-Icon enthalten, der den Sortier-Modus öffnet; er MUST in Größe und Stil den übrigen Einträgen entsprechen. Ohne Regale MUST der Sortier-Modus einen Hinweis zeigen, zuerst ein Regal anzulegen. Der Start-Screen MUST ein Regal (vorbelegt mit dem ersten in Regal-Reihenfolge) und ein Startfach als Zeile und Spalte innerhalb des Regal-Rasters abfragen.

#### Scenario: Einstieg über die untere Leiste
- **WHEN** der Nutzer am Handy in der unteren Leiste auf „Sortieren“ tippt
- **THEN** öffnet sich der Start-Screen des Sortier-Modus

#### Scenario: Ohne Regale
- **WHEN** der Nutzer ohne konfigurierte Regale den Sortier-Modus öffnet
- **THEN** sieht er den Hinweis, zuerst in der Sammlung ein Regal anzulegen

#### Scenario: Startfach wählen
- **WHEN** der Nutzer „Kallax-2“ und Zeile 1, Spalte 3 wählt und startet
- **THEN** beginnt der Sortier-Modus mit der ersten Platte, die laut Belegung in Kallax-2 Fach 1:3 liegt

#### Scenario: Leeres Startfach
- **WHEN** das gewählte Fach leer ist
- **THEN** beginnt der Sortier-Modus mit der ersten Platte des nächsten belegten Fachs in Regal-Reihenfolge

#### Scenario: Ungültiges Fach
- **WHEN** Zeile oder Spalte außerhalb des Rasters des Regals liegen
- **THEN** lässt sich der Modus nicht starten und das Feld wird als ungültig markiert
