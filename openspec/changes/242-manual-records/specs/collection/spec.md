## ADDED Requirements

### Requirement: Manuelle Platten anlegen und verwalten
Der Nutzer MUST Platten und CDs ohne Discogs-Eintrag manuell anlegen können (Pflicht: Künstler, Titel, Format; optional u. a. Jahr, Label, Katalognummer, Land, Barcode, Genres, Zustand, Notizen, eigener Wert, Cover). Manuelle Platten MUST in Sammlung, Regal, Statistik, Backup und Druck erscheinen und als „Manuell“ gekennzeichnet sein.

#### Scenario: Anlegen aus der Label-Inbox
- **WHEN** die Erkennung eines Label-Fotos keinen Discogs-Treffer findet
- **THEN** bietet die Inbox „Manuell anlegen“ an, mit aus dem Label gelesenen Feldern vorausgefüllt

#### Scenario: Anlegen mit Cover
- **WHEN** der Nutzer eine manuelle Platte mit Cover-Foto speichert
- **THEN** erscheint sie mit Cover und Badge „Manuell“ in der Sammlung und der Regalplatz wird angezeigt

### Requirement: Discogs-Sync schützt manuelle Platten
Der Discogs-Sync MUST manuelle Platten unverändert lassen, und für manuelle Platten MUST keine Discogs-Schnittstelle aufgerufen werden.

#### Scenario: Sync nach dem Anlegen
- **WHEN** nach dem Anlegen einer manuellen Platte der Discogs-Sync läuft
- **THEN** ist die manuelle Platte weiterhin in der Sammlung

### Requirement: Manuelle Platten per Scanner
Barcode und QR-Code einer manuellen Platte MUST lokal aufgelöst werden und ein Hör-Ereignis erfassen.

#### Scenario: Barcode einer manuellen Platte scannen
- **WHEN** der Nutzer den hinterlegten Barcode einer manuellen Platte scannt
- **THEN** wird die Platte ohne Discogs-Abfrage gefunden und als gehört erfasst

### Requirement: Backup mit manuellen Platten
Das JSON-Backup MUST manuelle Platten inklusive Cover enthalten (`format_version: 4`), und die Wiederherstellung MUST sie anhand von `manualUid` ohne Duplikate zusammenführen.

#### Scenario: Backup wiederherstellen
- **WHEN** ein Backup mit manuellen Platten in eine Instanz eingespielt wird, die diese bereits enthält
- **THEN** werden die vorhandenen Einträge aktualisiert und keine doppelt angelegt
