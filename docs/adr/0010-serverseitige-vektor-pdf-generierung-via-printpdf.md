# ADR-0010: Serverseitige Vektor-PDF-Generierung via `printpdf` und `fast_qr` statt Headless-Browser

* **Status:** Accepted
* **Datum:** 2026-10-15
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issues [#42](https://github.com/gerontosepp/vinyl-tracker/issues/42), [#89](https://github.com/gerontosepp/vinyl-tracker/issues/89), Release v0.8.0 / v0.9.0

---

## Kontext & Problemstellung

Vinyl Tracker bietet zwei zentrale Druck- und Dokumentationsfunktionen:
1. **QR-Code-Etikettenbögen (A4):** Zum Bekleben der Schutzhüllen mit gestochen scharfen QR-Codes, Künstlername, Albumtitel und Release-Jahr.
2. **Sammlungs- und Versicherungskatalog:** Ein hochwertiger, mehrseitiger PDF-Report mit Deckblatt, Wertübersicht (Gesamtwert, Median, Min, Max), Inhaltskarten und hochauflösendem Album-Artwork.

Bei der Architektur der PDF-Generierung standen zwei gegensätzliche Ansätze zur Auswahl: ein nativer serverseitiger Generator in Rust oder ein browsergestützter Ansatz (z. B. Headless Chromium via Puppeteer oder clientseitiges jsPDF).

## Entscheidungstreiber

* **Geringer Ressourcenverbrauch:** Die Zielplattformen sind kleine Server (Raspberry Pi, Proxmox LXCs mit 1–2 GB RAM). Ein Tool darf den Server nicht durch OOM (Out-of-Memory) gefährden.
* **Druckqualität:** Vektorbasierte QR-Codes (ohne Pixelartefakte beim Einscannen) und typografisch saubere Layouts.
* **Unabhängigkeit vom Client:** Export von 1.000+ Platten muss serverseitig stabil durchlaufen, ohne mobile Webbrowser zu überfordern.
* **Keine externen Runtimes:** Keine Node.js-, Python- oder Chromium-Systempakete im Produktions-Container.

## Betrachtete Optionen

* **Option 1: Native Rust Vektor-PDF-Engine mit `printpdf` und `fast_qr` (Gewählt)**
  * *Vorteile:* Minimaler Speicherbedarf (< 15 MB während der Generierung); extrem schnell (A4-Bogen mit Dutzenden QR-Codes in < 200 ms generiert); QR-Codes werden direkt als Vektorpfade gerendert (100 % Scansicherheit bei jeder Skalierung); keine externen Browser-Abhängigkeiten im Docker-Image.
  * *Nachteile:* Manuelle Berechnung von Koordinaten, Seitenumbrüchen und Text-Wrapping (`azul-layout`, `image`).

* **Option 2: Headless Chrome / Puppeteer im Backend**
  * *Vorteile:* Einfache Gestaltung via HTML/CSS (`@media print`).
  * *Nachteile:* Benötigt Chromium (~300 MB zusätzliches Docker-Image); Kaltstart von Chromium benötigt 1–2 Sekunden und 200–400 MB RAM; instabil auf minimalen Proxmox-Containern.

* **Option 3: Clientseitige Generierung im Browser (z. B. `jsPDF` / `pdfmake`)**
  * *Vorteile:* Entlastet den Server vollständig.
  * *Nachteile:* Stürzt bei größeren Sammlungen (> 200 Alben mit Bildern) im Browser durch Speichermangel ab (besonders auf Smartphones/Tablets); inkonsistente Schriftartendarstellung je nach Betriebssystem.

## Entscheidung

Die PDF-Generierung wird **vollständig serverseitig in Rust** implementiert:
* **`printpdf` (v0.12):** Erzeugung von PDF-Dokumenten mit Vektorgrafiken, Schrift-Embedding und exakter Millimeter-Platzierung auf DIN A4.
* **`fast_qr` (v0.14):** Extrem schnelle Vektor-Generierung von QR-Codes mit Fehlerkorrekturlevel M.
* **`image` & `azul-layout`:** Skalierung von Cover-Artworks und Text-Layouting für mehrseitige Kataloge.

Dienste:
* `QrPdfService`: Erzeugt A4-Etikettenbögen für die gesamte Sammlung oder selektiv ausgewählte Datensätze (`/api/collection/qr-codes/selected`).
* `ExportService`: Erzeugt druckfertige Sammlungs- und Versicherungskataloge (`/api/collection/export?format=pdf`).

## Konsequenzen

### Positive Effekte
* **Ressourcenschonend:** Minimaler RAM-Peak selbst bei hunderten Seiten; Docker-Image bleibt winzig.
* **Gestochen scharfe Scans:** Vektor-QR-Codes lassen sich selbst bei minimaler Druckgröße (15×15 mm) fehlerfrei von Handscannern lesen.
* **Schnelle Generierung:** Selbst große Sammlungsberichte stehen innerhalb weniger Sekunden als Download bereit.

### Nachteile & Risiken
* **Layout-Aufwand:** Komplexere visuelle Umbrüche erfordern manuelle Layout-Berechnungen in Rust statt einfachem CSS-Grid.
