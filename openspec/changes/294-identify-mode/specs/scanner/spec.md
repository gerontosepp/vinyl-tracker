## ADDED Requirements

### Requirement: Identify Mode
Der Scanner MUST einen Identify Mode anbieten, den der Nutzer im Scanner ein- und ausschalten kann und der gemerkt wird. Im Identify Mode MUST ein Scan keine Hör-Ereignisse schreiben. Ist die gescannte Platte im Bestand, MUST die App dieselben Informationen zeigen wie die Detailansicht der Plattenliste. Der Scanner MUST danach für den nächsten Scan bereit bleiben. Ist die Platte nicht im Bestand, MUST der normale Ablauf (Discogs-Treffer, Übernahme, manuell anlegen) greifen.

#### Scenario: Platte im Bestand identifizieren
- **WHEN** der Identify Mode aktiv ist und der Nutzer den Barcode einer Platte im Bestand scannt
- **THEN** öffnet sich die Detailansicht der Platte und es wird kein Hör-Ereignis gespeichert

#### Scenario: Mehrere Platten nacheinander
- **WHEN** der Nutzer die Detailansicht schließt
- **THEN** ist der Scanner sofort bereit für die nächste Platte

#### Scenario: Platte nicht im Bestand
- **WHEN** der Identify Mode aktiv ist und die Platte nicht im Bestand ist
- **THEN** zeigt der Scanner wie sonst die Discogs-Treffer bzw. „nicht gefunden“

### Requirement: Scan-Endpunkt ohne Hör-Ereignis
`POST /api/scan` MUST das optionale Feld `identify` (Standard `false`) akzeptieren. Mit `identify: true` MUST die Auflösung (Barcode, QR, manuelle Platten) unverändert sein, aber kein Hör-Ereignis entstehen.

#### Scenario: Scan mit identify
- **WHEN** ein Client `POST /api/scan` mit `identify: true` für eine Platte im Bestand aufruft
- **THEN** liefert die Antwort die Platte und die Zahl der Hör-Ereignisse bleibt gleich
