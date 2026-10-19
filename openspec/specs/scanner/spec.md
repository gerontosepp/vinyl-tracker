# Spezifikation: Hardware-Barcode-Scanner-Integration (Scanner)

## 1. Übersicht & Zielsetzung
Unterstützt physische Barcode-Scanner (z. B. Eyoyo Bluetooth/USB-Handsensor oder Ringscanner), die als Human Interface Device (HID Keyboard Wedge) agieren, um Schallplatten nahtlos über EAN/UPC-Barcodes zu identifizieren und aufzunehmen – ohne dass ein spezielles Eingabefeld im Browser fokussiert sein muss.

---

## 2. Kernfunktionen & Anforderungen

### 2.1 HID Keyboard Wedge Puffer
* Da Hardware-Scanner Scancodes als extrem schnelle Tastenanschläge gefolgt von einem `Enter`-Tastencode an das Betriebssystem senden, implementiert das Frontend einen globalen Keydown-Listener:
  - **Inter-Key Timeout**: Tastenfolgen, die schneller als 50 ms pro Zeichen eingehen, werden als Hardware-Scan interpretiert.
  - **Enter-Terminierung**: Das abschließende `Enter`-Ereignis schließt den Puffer ab, unterdrückt das Standardverhalten (`event.preventDefault()`) und übergibt den Barcode an den Scan-Handler.
  - **Manuelle Eingaben**: Langsame Tastenanschläge von normalen Tastaturen werden verworfen bzw. an reguläre Eingabefelder weitergeleitet.

### 2.2 Barcode-Auflösung & Lookup
* Nach Empfang eines Barcodes wird der Endpunkt `POST /api/scans` (oder MCP `scan_barcode`) aufgerufen:
  1. Zuerst wird geprüft, ob die EAN/UPC bereits einem Album in der lokalen Sammlung zugeordnet ist.
  2. Falls lokal vorhanden: Sofortige Weiterleitung auf die Detailansicht und optionale Protokollierung als Hör-Event.
  3. Falls nicht vorhanden: Abfrage der Discogs Database API nach passenden Releases mit diesem Barcode.
  4. Bei mehreren Treffern: Darstellung eines Auswahldialogs für den Benutzer.
  5. Bei eindeutigem Treffer: Automatische Vorbefüllung zur Übernahme in die Sammlung.

### 2.3 Audio- & Haptisches Feedback
* Erfolgreiche Scans werden durch optische Indikatoren (Toast / Banner) und optionales akustisches Feedback quittiert.
