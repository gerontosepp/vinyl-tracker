## ADDED Requirements

### Requirement: Hilfeseite
Die App MUST unter `/help` eine Hilfeseite anbieten, die alle Funktionen erklärt, über die Seitenleiste (Desktop) und die obere Leiste (Handy) erreichbar ist, ein Inhaltsverzeichnis mit Sprungmarken und eine Suche über die Abschnitte bietet. Der Inhalt MUST aus `docs/Help.md` bzw. `docs/Help.en.md` stammen und in beiden Sprachen dieselben Abschnitte haben.

#### Scenario: Hilfe durchsuchen
- **WHEN** der Nutzer auf der Hilfeseite einen Suchbegriff eingibt
- **THEN** werden nur die Abschnitte angezeigt, die alle Suchbegriffe enthalten

### Requirement: Kontext-Hilfe
Seiten mit eigenen Funktionen (Scan, Sammlung, Regale, Label-Inbox, Sortiermodus, Einstellungen) MUST ein ?-Symbol anbieten, das die Hilfe beim passenden Abschnitt öffnet.

#### Scenario: Hilfe zu den Regalen
- **WHEN** der Nutzer in der Regalansicht auf das ?-Symbol tippt
- **THEN** öffnet sich die Hilfe am Abschnitt „Regale“

### Requirement: Tooltips
Symbol-Buttons und erklärungsbedürftige Bedienelemente MUST einen Tooltip zeigen – bei Mauszeiger, Tastatur-Fokus und langem Drücken auf Touch-Geräten – und für Screenreader beschriftet sein.

#### Scenario: Tooltip am Handy
- **WHEN** der Nutzer einen Symbol-Button lange gedrückt hält
- **THEN** erscheint die Beschreibung und verschwindet nach dem Loslassen wieder
