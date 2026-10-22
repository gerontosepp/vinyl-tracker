# label-photo Specification

## Purpose
TBD - created by archiving change 208-label-photo-identification. Update Purpose after archive.

## Requirements

### Requirement: Label-Foto in der PWA aufnehmen
Die Scanner-Seite MUST einen Button „Label fotografieren“ anbieten, der die Kamera bzw. Bildauswahl des Geräts öffnet. Das Foto MUST vor dem Upload clientseitig auf höchstens 1568 px lange Kante verkleinert und als JPEG an `POST /api/label-photos` gesendet werden. Die Seite MUST die Anzahl offener Fotos anzeigen.

#### Scenario: Foto in die Inbox
- **WHEN** der Nutzer ein Label fotografiert
- **THEN** wird das Foto gespeichert, ein Toast bestätigt den Upload und die Anzahl offener Fotos erhöht sich

#### Scenario: Upload schlägt fehl
- **WHEN** das Backend den Upload ablehnt oder nicht erreichbar ist
- **THEN** zeigt die Seite einen Fehler-Toast und die Anzahl bleibt unverändert

### Requirement: Label-Fotos speichern
Das Backend MUST hochgeladene Bilder (JPEG/PNG, max. 15 MB) dekodieren, auf höchstens 1568 px lange Kante verkleinern und als JPEG ohne Metadaten (EXIF/GPS) mit Status `pending` in `label_photo` speichern. Nicht dekodierbare Daten MUST mit 400 abgelehnt werden.

#### Scenario: Großes Foto
- **WHEN** ein 4000×3000-JPEG mit EXIF-Daten hochgeladen wird
- **THEN** speichert das Backend ein JPEG mit 1568×1176 px ohne EXIF und antwortet mit 201 und der Anzahl offener Fotos

#### Scenario: Kein Bild
- **WHEN** der Body kein dekodierbares Bild ist
- **THEN** antwortet das Backend mit 400 als ProblemDetail

### Requirement: Label-Inbox verwalten
Das Backend MUST Endpunkte zum Auflisten (Metadaten, filterbar nach Status), Abrufen des Bildes, Setzen von Status (`identified` | `failed` | `pending`) und optionaler Discogs-ID sowie zum Löschen bereitstellen. Nutzer MUST nur ihre eigenen Fotos sehen und ändern können.

#### Scenario: Fremdes Foto
- **WHEN** ein Nutzer das Foto eines anderen Nutzers abruft, ändert oder löscht
- **THEN** antwortet das Backend mit 404

#### Scenario: Foto abschließen
- **WHEN** ein Foto mit Status `identified` und Discogs-ID 12345 aktualisiert wird
- **THEN** speichert das Backend Status, Discogs-ID und den Zeitpunkt der Bearbeitung (UTC)
