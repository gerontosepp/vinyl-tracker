# sort-mode Specification

## Purpose
TBD - created by archiving change 172-sort-mode. Update Purpose after archive.

## Requirements

### Requirement: Sortier-Modus starten
Die Startseite MUST in der Mobil-Ansicht einen Button „Sortieren“ anzeigen, wenn für den Nutzer mindestens ein Regal konfiguriert ist; in der Desktop-Ansicht und ohne Regale MUST er fehlen. Der Start-Screen MUST ein Regal (vorbelegt mit dem ersten in Regal-Reihenfolge) und ein Startfach als Zeile und Spalte innerhalb des Regal-Rasters abfragen.

#### Scenario: Button nur mobil mit Regalen
- **WHEN** der Nutzer mit konfigurierten Regalen die Startseite auf dem Handy öffnet
- **THEN** sieht er den Button „Sortieren“; am Desktop oder ohne Regale ist er nicht sichtbar

#### Scenario: Startfach wählen
- **WHEN** der Nutzer „Kallax-2“ und Zeile 1, Spalte 3 wählt und startet
- **THEN** beginnt der Sortier-Modus mit der ersten Platte, die laut Belegung in Kallax-2 Fach 1:3 liegt

#### Scenario: Leeres Startfach
- **WHEN** das gewählte Fach leer ist
- **THEN** beginnt der Sortier-Modus mit der ersten Platte des nächsten belegten Fachs in Regal-Reihenfolge

#### Scenario: Ungültiges Fach
- **WHEN** Zeile oder Spalte außerhalb des Rasters des Regals liegen
- **THEN** lässt sich der Modus nicht starten und das Feld wird als ungültig markiert

### Requirement: Sortier-Screen
Der Sortier-Screen MUST im Vollbild ohne Navigation laufen und nur Cover, Titel, Interpret, das aktuelle Fach („Regal · Zeile:Spalte“) und den Fortschritt im Fach („12 / 70“: Position und Anzahl der Platten des Fachs) anzeigen. Wechselt die angezeigte Platte gegenüber der vorherigen das Fach, MUST ein deutlich hervorgehobener Hinweis „Neues Fach“ erscheinen; auch die erste Platte zeigt ihr Fach so an.

#### Scenario: Platte anzeigen
- **WHEN** die 12. von 70 Platten in Kallax-1 Fach 2:3 angezeigt wird
- **THEN** zeigt der Screen Cover, Titel, Interpret, „Kallax-1 · 2:3“ und „12 / 70“

#### Scenario: Fachwechsel
- **WHEN** der Nutzer nach der letzten Platte von Fach 2:3 „Weiter“ wählt
- **THEN** zeigt der Screen die erste Platte von Fach 2:4 mit dem hervorgehobenen Hinweis „Neues Fach“

#### Scenario: Platten ohne Platz
- **WHEN** nach dem letzten Fach des letzten Regals noch Platten ohne Platz folgen
- **THEN** werden sie mit „Ohne Platz“ statt eines Fachs angezeigt

### Requirement: Navigation im Sortier-Modus
Der Sortier-Screen MUST genau drei Controls bieten: „Weiter“ (deutlich größer als die anderen), „Zurück“ und „Beenden“. Die Reihenfolge MUST der berechneten Belegung des Mediums folgen und am Ende eines Regals nahtlos im nächsten Regal desselben Mediums weitergehen. Die Reihenfolge MUST beim Start festgelegt werden und sich während der Sitzung nicht ändern.

#### Scenario: Weiter und Zurück
- **WHEN** der Nutzer „Weiter“ und danach „Zurück“ wählt
- **THEN** zeigt der Screen erst die nächste und dann wieder die vorige Platte; auf der ersten Platte ist „Zurück“ deaktiviert

#### Scenario: Regalwechsel
- **WHEN** der Nutzer nach der letzten Platte von Kallax-1 „Weiter“ wählt
- **THEN** folgt die erste Platte von Kallax-2 mit dem Hinweis „Neues Fach“

#### Scenario: Abschluss
- **WHEN** der Nutzer nach der letzten Platte „Weiter“ wählt
- **THEN** zeigt ein Abschluss-Screen die Anzahl der sortierten Platten und führt zur Startseite zurück

#### Scenario: Beenden
- **WHEN** der Nutzer „Beenden“ wählt
- **THEN** endet der Sortier-Modus und die Startseite erscheint

### Requirement: Bildschirm wach halten
Während der Sortier-Screen sichtbar ist, MUST der Modus eine Screen Wake Lock anfordern, sofern der Browser sie unterstützt, sie nach dem Wechsel zurück in den Vordergrund erneut anfordern und beim Beenden freigeben. Ohne Unterstützung MUST der Modus ohne Fehlermeldung funktionieren.

#### Scenario: Wake Lock
- **WHEN** der Sortier-Modus läuft und der Browser Wake Lock unterstützt
- **THEN** bleibt der Bildschirm an, bis der Nutzer den Modus beendet

### Requirement: Sortier-Reihenfolge abrufen
`GET /api/storage/sequence?media=vinyl|cd` MUST alle Exemplare des Mediums in Regal-Reihenfolge mit Discogs-ID, Interpret, Titel, Cover-URL und berechnetem Lagerplatz liefern, Exemplare ohne Platz am Ende. Ohne Regale für das Medium MUST die Liste leer sein; ein ungültiges Medium MUST mit 400 beantwortet werden.

#### Scenario: Reihenfolge
- **WHEN** der Client die Sequenz für Platten abruft
- **THEN** stimmt die Reihenfolge mit der Regal-Übersicht überein und jedes Exemplar trägt seinen Lagerplatz
