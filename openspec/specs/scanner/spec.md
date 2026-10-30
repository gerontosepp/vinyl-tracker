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

### Requirement: Scan-Endpunkt ohne Hör-Ereignis
`POST /api/scan` MUST das optionale Feld `identify` (Standard `false`) akzeptieren. Mit `identify: true` MUST die Auflösung (Barcode, QR, manuelle Platten) unverändert sein, aber kein Hör-Ereignis entstehen.

#### Scenario: Scan mit identify
- **WHEN** ein Client `POST /api/scan` mit `identify: true` für eine Platte im Bestand aufruft
- **THEN** liefert die Antwort die Platte und die Zahl der Hör-Ereignisse bleibt gleich
