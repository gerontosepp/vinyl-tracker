# ADR-0007: Eyoyo EY-009P & Hardware-Scanner-Integration via globalem HID Keyboard Wedge Listener

* **Status:** Accepted
* **Datum:** 2026-10-12
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issues [#45](https://github.com/gerontosepp/vinyl-tracker/issues/45), [#49](https://github.com/gerontosepp/vinyl-tracker/issues/49), Release v0.5.0

---

## Kontext & Problemstellung

Für die Erfassung und das Abspielen von Schallplatten nutzen viele Sammler physische Handscanner (wie den Eyoyo EY-009P 1D/2D-Barcode- und QR-Scanner über 2,4-GHz-Funk oder Bluetooth). Bislang basierte Vinyl Tracker ausschließlich auf einer kamerabasierten Scan-Lösung (`html5-qrcode`).

Die kamerabasierte Lösung weist bei der Nutzung mit Hardware-Scannern erhebliche Nachteile auf:
* Hoher Akkuverbrauch auf mobilen Geräten und Laptops durch kontinuierlich laufende Videostreams.
* Notwendigkeit von Kamera-Berechtigungsdialogen im Browser.
* Schlechte Beleuchtungsverhältnisse oder spiegelnde Vinyl-Hüllen erschweren das optische Kamera-Scanning.
* Hardware-Scanner senden gescannte Codes typischerweise als schnelle Folge von Tastatur-Eingaben (HID Keyboard Wedge), die verloren gehen, wenn kein Eingabefeld im Browser fokussiert ist.

## Entscheidungstreiber

* **Hands-Free User Experience:** Der Scanner muss überall in der App funktionieren, ohne dass der Benutzer zuvor manuell mit der Maus ein Eingabefeld anklicken muss.
* **Akkuschonung & Performance:** Die Kamera soll im reinen Hardware-Betrieb vollständig deaktiviert bleiben.
* **Fehlertoleranz:** Zuverlässige Unterscheidung zwischen schnellen menschlichen Tastatureingaben und Scannern anhand von Timing-Heuristiken.
* **Plattformunabhängigkeit:** Funktionsfähig auf allen Betriebssystemen (macOS, Windows, Linux, Android/iOS) ohne Notwendigkeit spezieller Treiber oder nativer Desktop-Apps.

## Betrachtete Optionen

* **Option 1: Globaler Tastatur-Wedge-Listener mit Timing-Heuristik (Gewählt)**
  * *Vorteile:* Standard-HID-Modus aller handelsüblichen Barcode-Scanner; läuft in jedem Standard-Browser; kein Pairing-Dialog via WebHID nötig; 3 frei wählbare Modi (*Hardware-Scanner*, *Kamera*, *Hybrid*); Kamera bleibt im Hardware-Modus stromsparend aus.
  * *Nachteile:* Erfordert Pufferung und Timing-Analyse im `ScannerService`, um schnelle Scanner-Sequenzen (z. B. < 30 ms zwischen Tastenanschlägen) von normalen Benutzereingaben zu trennen.

* **Option 2: WebHID / WebSerial API**
  * *Vorteile:* Direkter Zugriff auf Raw-USB/Bluetooth-Events ohne Eingabe-Emulation.
  * *Nachteile:* Eingeschränkte Browser-Kompatibilität (kein Safari / iOS, unvollständig unter Firefox); erfordert wiederholte manuelle Freigabedialoge; bricht bei Funk-Dongles ab.

* **Option 3: Dauerhaft fokussiertes verstecktes `<input>`-Feld**
  * *Vorteile:* Sehr einfache Implementierung.
  * *Nachteile:* Extrem fehleranfällig; verliert den Fokus bei Modals, Dropdowns oder Navigation; erzeugt unerwünschte Bildschirm-Tastaturen auf Touch-Geräten.

## Entscheidung

Die Hardware-Scanner-Anbindung wird über einen **globalen HID Keyboard Wedge Listener** im Angular `ScannerService` implementiert:
1. **Betriebsmodi:** In den Einstellungen wählbar zwischen:
   * *Externer Hardware-Scanner:* Kamera bleibt permanent ausgeschaltet; ideal für den stationären Einsatz.
   * *Interner Kamera-Scanner:* Klassischer Scan über die Geräte-Kamera (`html5-qrcode`).
   * *Hybrid-Modus:* Beide Methoden sind parallel aktiv.
2. **Timing-Heuristik:** Schnelle Ziffern-/Zeichenfolgen mit abschließendem `Enter` (CR/LF) werden gepuffert und bei typischen Scanner-Intervallen (< 50 ms) als Barcode/QR-Code erkannt und verarbeitet.
3. **Feedback & Diagnose:** Akustisches Bestätigungssignal (Audio-Beep via Web Audio API) sowie ein interaktiver Scanner-Testbereich in den Einstellungen.

## Konsequenzen

### Positive Effekte
* **Hervorragende Ergonomie:** Platten können direkt am Regal mit dem Handscanner erfasst werden, ohne den Rechner zu berühren.
* **Batterieschonend:** Auf Laptops und Tablets bleibt die Kamera stromsparend aus.
* **Universal einsetzbar:** Funktioniert mit jedem HID-kompatiblen Barcode- und QR-Scanner (USB, Bluetooth, Funk).

### Nachteile & Risiken
* **Fokus-Konflikte bei Formularen:** Wenn der Benutzer aktiv in Textfeldern (z. B. Suchleiste) tippt, muss der Scanner-Puffer sauber entprellt werden.
