# label-photo Specification

## Purpose
Records without a barcode are identified from a photo of their label: the PWA collects label photos in a per-user inbox, and Claude processes them through the MCP server.

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

### Requirement: Label-Inbox in der PWA bearbeiten
Die PWA MUST unter `/label-inbox` die offenen Label-Fotos des Nutzers mit Aufnahmedatum anzeigen und das Löschen einzelner Fotos sowie aller offenen Fotos (nach Bestätigung) erlauben. Das Inbox-Badge der Scan-Seite MUST zu dieser Ansicht führen. `DELETE /api/label-photos` MUST alle Fotos des Nutzers löschen, mit `status` nur die Fotos dieses Status, und die Anzahl gelöschter sowie offener Fotos liefern.

#### Scenario: Alle offenen Fotos löschen
- **WHEN** der Nutzer in der Label-Inbox „Alle löschen“ bestätigt
- **THEN** werden nur seine offenen Fotos gelöscht und die Ansicht zeigt eine leere Inbox

#### Scenario: Einzelnes Foto löschen
- **WHEN** der Nutzer bei einem Foto „Löschen“ wählt
- **THEN** verschwindet nur dieses Foto aus der Inbox

### Requirement: Automatische Erkennung per OpenRouter
Hat der Nutzer einen OpenRouter-API-Key hinterlegt, MUST das Backend jedes neu hochgeladene Label-Foto im Hintergrund mit dem gewählten Modell erkennen und den Vorschlag (bester Treffer, Alternativen, Sicherheit, Begründung, Hinweis) am Foto speichern. Das Modell MUST nur lesende Tools erhalten; vorgeschlagene Discogs-IDs MUST aus Tool-Ergebnissen derselben Erkennung stammen. Ohne Key MUST sich das Verhalten nicht ändern. Der Key MUST verschlüsselt gespeichert und nie ausgeliefert werden.

#### Scenario: Foto wird erkannt
- **WHEN** der Nutzer mit hinterlegtem Key ein Label fotografiert
- **THEN** zeigt die Label-Inbox nach der Erkennung die vorgeschlagene Pressung zur Bestätigung

#### Scenario: Erfundene Release-ID
- **WHEN** das Modell eine Discogs-ID vorschlägt, die keine Suche geliefert hat
- **THEN** wird die Erkennung als Fehler gespeichert und kann erneut gestartet werden

#### Scenario: Bestätigen
- **WHEN** der Nutzer in der Label-Inbox „Hinzufügen“ wählt
- **THEN** wird die Platte zur Sammlung hinzugefügt, das Foto als `identified` abgeschlossen und der Regalplatz angezeigt
