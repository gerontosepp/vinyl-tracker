# Spezifikation: Hardware-Barcode-Scanner-Integration (Scanner)

## Purpose
Unterstützt physische Barcode-Scanner (z. B. Eyoyo Bluetooth/USB-Handsensor oder Ringscanner), die als Human Interface Device (HID Keyboard Wedge) agieren, um Schallplatten nahtlos über EAN/UPC-Barcodes zu identifizieren und aufzunehmen – ohne dass ein spezielles Eingabefeld im Browser fokussiert sein muss.

---

## 2. Kernfunktionen & Anforderungen

### 2.1 HID Keyboard Wedge Puffer
* Da Hardware-Scanner Scancodes als extrem schnelle Tastenanschläge gefolgt von einem `Enter`-Tastencode an das Betriebssystem senden, implementiert das Frontend einen globalen Keydown-Listener:
  - **Inter-Key Timeout**: Der Puffer wird verworfen, wenn zwischen zwei Zeichen mehr als 120 ms liegen. Eine Folge von mindestens 3 Zeichen mit `Enter` gilt als Hardware-Scan, wenn der durchschnittliche Abstand in einem Eingabefeld unter 75 ms und außerhalb von Eingabefeldern unter 130 ms liegt.
  - **Enter-Terminierung**: Das abschließende `Enter`-Ereignis schließt den Puffer ab, unterdrückt das Standardverhalten (`event.preventDefault()`) und übergibt den Barcode an den Scan-Handler.
  - **Manuelle Eingaben**: Langsame Tastenanschläge von normalen Tastaturen werden verworfen bzw. an reguläre Eingabefelder weitergeleitet.
  - **Verworfener Scan**: Außerhalb von Eingabefeldern tippt niemand. Gehen mindestens 3 Zeichen und ein `Enter` ein, ohne dass die Folge als Scan erkannt wird (z. B. weil der Scanner am Handy zu langsam sendet), zeigt die App den Hinweis „Scan nicht erkannt. Bitte erneut scannen.“ als Warnung. In Eingabefeldern erscheint er nicht.

### 2.2 Barcode-Auflösung & Lookup
* Nach Empfang eines Barcodes wird der Endpunkt `POST /api/scans` (oder MCP `scan_barcode`) aufgerufen:
  1. Zuerst wird geprüft, ob die EAN/UPC bereits einem Album in der lokalen Sammlung zugeordnet ist.
  2. Falls lokal vorhanden: Sofortige Weiterleitung auf die Detailansicht und optionale Protokollierung als Hör-Event.
  3. Falls nicht vorhanden: Abfrage der Discogs Database API nach passenden Releases mit diesem Barcode.
  4. Bei mehreren Treffern: Darstellung eines Auswahldialogs für den Benutzer.
  5. Bei eindeutigem Treffer: Automatische Vorbefüllung zur Übernahme in die Sammlung.

### 2.3 Audio- & Haptisches Feedback
* Erfolgreiche Scans werden durch optische Indikatoren (Toast / Banner) und optionales akustisches Feedback quittiert.

## Requirements

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

### Requirement: Anzeige nach erfasstem Hören
Nach einem Scan, der ein Hör-Ereignis erfasst hat, MUST der Scanner die gescannte Platte für eine konfigurierbare Dauer anzeigen und danach wieder den normalen Scan-Bildschirm zeigen. Die Dauer MUST unter Einstellungen → Barcode & QR Scanner zwischen 5 und 120 Sekunden einstellbar sein, standardmäßig 30 Sekunden, und pro Gerät gemerkt werden. Ein weiterer Scan in dieser Zeit MUST die Anzeige ersetzen und die Dauer neu starten; „Nächste Platte scannen“ MUST sofort zurücksetzen. Ergebnisse, bei denen der Nutzer entscheiden muss (Discogs-Treffer) oder die einen Fehler zeigen, MUST stehen bleiben.

#### Scenario: Platte nach der eingestellten Dauer ausblenden
- **WHEN** ein Scan ein Hör-Ereignis erfasst hat und die eingestellte Anzeigedauer vergangen ist
- **THEN** zeigt der Scanner wieder den normalen Scan-Bildschirm

#### Scenario: Standarddauer ohne Einstellung
- **WHEN** der Nutzer die Anzeigedauer nicht geändert hat und ein Scan ein Hör-Ereignis erfasst hat
- **THEN** bleibt die Platte 30 Sekunden sichtbar

#### Scenario: Neuer Scan startet die Zeit neu
- **WHEN** innerhalb der eingestellten Anzeigedauer eine weitere Platte gescannt wird
- **THEN** wird die neue Platte angezeigt und die Anzeigedauer beginnt neu

### Requirement: Scan-Endpunkt ohne Hör-Ereignis
`POST /api/scan` MUST das optionale Feld `identify` (Standard `false`) akzeptieren. Mit `identify: true` MUST die Auflösung (Barcode, QR, manuelle Platten) unverändert sein, aber kein Hör-Ereignis entstehen.

#### Scenario: Scan mit identify
- **WHEN** ein Client `POST /api/scan` mit `identify: true` für eine Platte im Bestand aufruft
- **THEN** liefert die Antwort die Platte und die Zahl der Hör-Ereignisse bleibt gleich

### Requirement: Ein Scan wird genau einmal verarbeitet
Ein ausgelöster Scan-Auftrag MUST nach seiner Verarbeitung verbraucht sein. Wird der Scanner-Bildschirm geschlossen und erneut geöffnet, MUST der zuletzt gescannte Code nicht erneut verarbeitet werden und kein weiteres Hör-Ereignis entstehen.

#### Scenario: Scanner schließen und erneut öffnen
- **WHEN** ein Scan ein Hör-Ereignis erfasst hat und der Nutzer den Scanner schließt und wieder öffnet
- **THEN** zeigt der Scanner den normalen Scan-Bildschirm, und der Play-Count der Platte steigt nicht erneut

### Requirement: Scan-Widget außerhalb des Scanner-Bildschirms
Nach einem Scan mit Hör-Ereignis, während der Scanner-Bildschirm nicht offen ist, MUST die App auf der aktuellen Seite bleiben und die Platte als schwebendes Widget unten rechts mit Titel, Künstler, Cover und „Jetzt aufgelegt“ anzeigen. Solange der Scanner-Bildschirm offen ist, DARF kein Widget erscheinen; dort gilt die Inline-Anzeige. Scans, die eine Entscheidung brauchen oder im Identify Mode laufen, MUST weiterhin den Scanner-Bildschirm öffnen.

#### Scenario: Scan auf einer beliebigen Seite
- **WHEN** der Nutzer auf der Sammlung einen Barcode scannt, der ein Hör-Ereignis erfasst
- **THEN** bleibt die Sammlung sichtbar, und unten rechts erscheint das Widget mit Cover, Titel und Künstler der Platte

#### Scenario: Scanner-Bildschirm bleibt unverändert
- **WHEN** der Scanner-Bildschirm offen ist und ein Scan ein Hör-Ereignis erfasst
- **THEN** zeigt der Scanner seine Inline-Karte und kein zusätzliches Widget

#### Scenario: Entscheidung oder Identify Mode
- **WHEN** ein Scan einen Discogs-Treffer zur Auswahl liefert oder im Identify Mode läuft
- **THEN** öffnet sich der Scanner-Bildschirm wie bisher und es erscheint kein Widget

### Requirement: Anzeigedauer des Scan-Widgets
Das Widget MUST nach der konfigurierten Anzeigedauer verschwinden. Ein weiterer Scan MUST es ersetzen und die Anzeigedauer neu starten.

#### Scenario: Ausblenden nach der eingestellten Dauer
- **WHEN** die eingestellte Anzeigedauer seit dem Erscheinen des Widgets vergangen ist, ohne dass der Nutzer es berührt hat
- **THEN** verschwindet das Widget

#### Scenario: Neuer Scan ersetzt das Widget
- **WHEN** innerhalb der Anzeigedauer eine weitere Platte gescannt wird
- **THEN** zeigt das Widget die neue Platte und die Anzeigedauer beginnt neu

### Requirement: Interaktion mit dem Scan-Widget
Interaktion mit dem Widget MUST den Timeout pausieren; nach dem Verlassen MUST die verbleibende Zeit weiterlaufen. Ein Close-Button MUST das Widget sofort schließen. Ein Klick auf die Platte MUST die Detailansicht der Platte in der Sammlung öffnen.

#### Scenario: Hover pausiert den Timeout
- **WHEN** der Nutzer den Mauszeiger über das Widget bewegt
- **THEN** bleibt es länger als die eingestellte Dauer sichtbar, und nach dem Verlassen läuft die Restzeit weiter

#### Scenario: Fokus pausiert den Timeout
- **WHEN** der Nutzer das Widget per Tastatur fokussiert
- **THEN** pausiert der Timeout, bis der Fokus das Widget wieder verlässt

#### Scenario: Close-Button
- **WHEN** der Nutzer den Close-Button betätigt
- **THEN** verschwindet das Widget sofort

#### Scenario: Platte öffnen
- **WHEN** der Nutzer auf die Platte im Widget klickt
- **THEN** öffnet sich die Detailansicht der Platte in der Sammlung
