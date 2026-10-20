# ADR-0019: Druck-Modul mit Vorlagen-Renderern

* **Status:** Accepted
* **Datum:** 2026-10-20
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issues [#157](https://github.com/gerontosepp/vinyl-tracker/issues/157) und [#56](https://github.com/gerontosepp/vinyl-tracker/issues/56), OpenSpec-Change `157-print-module`

---

## Kontext & Problemstellung

Der einzige Ausdruck war ein QR-Code-PDF mit festem Layout (9 Karten pro A4-Seite), erreichbar über zwei eigene Endpunkte (`/api/collection/qr-codes/all` und `/selected`). Der Auswahl-Endpunkt bekam Titel und Künstler vom Client. Gewünscht sind Etiketten für Avery Zweckform 6605/3474 (#56) und weitere Ausdrucke (Scan-, Verkaufs-, Inventurlisten). Jeder davon hätte einen eigenen Endpunkt, Button und Datenpfad gebraucht.

## Entscheidungstreiber

* Neue Ausdrucke ohne Änderung an Route, Datenbeschaffung oder Frontend-Grundgerüst ergänzen.
* Ausdrucke für die ganze Sammlung, die aktuellen Filter der Sammlungsansicht oder eine Auswahl.
* Vorlagen brauchen unterschiedliche Daten (Jahr, Format, künftig Preise und Zustände).
* Weiterhin serverseitige Vektor-PDFs mit `printpdf` (ADR-0010), keine neuen Abhängigkeiten.

## Betrachtete Optionen

* **Option 1: Ein Endpunkt, Vorlagen als Renderer (gewählt)** – `POST /api/print` mit Vorlage, Umfang und Optionen; jede Vorlage implementiert ein gemeinsames Renderer-Interface.
* **Option 2: Ein Endpunkt pro Ausdruck** – einfach für den ersten Fall, aber doppelte Datenbeschaffung, Validierung und Frontend-Anbindung je Vorlage.
* **Option 3: Konfigurierbares Layout-Modell (Raster/Zellen als Daten)** – flexibel, für die absehbaren Vorlagen aber deutlich überdimensioniert.

## Entscheidung

Option 1:

1. **Endpunkt `POST /api/print`** mit JSON-Body `{ template, scope, options }`. `scope` ist `all`, `filter` (dieselben Parameter wie `GET /api/collection`) oder `ids` (Discogs-IDs, max. 5 000). `options` enthält die Sprache der Beschriftung (de/en) und das Start-Etikett (1–24).
2. **Der Server liest die Daten** über `CollectionQueryService::get_collection_for_export` (ein Eintrag je Exemplar, Standard-Sortierung nach Künstler). Der Client schickt keine Plattendaten mehr.
3. **Renderer pro Vorlage** in `backend/src/services/print/` (`avery.rs`, `scan_list.rs`, `qr_cards.rs`) über ein gemeinsames Trait; Textmessung, Zeilenumbruch, QR-Rasterbild, Text-/Rechteck-Operationen und die festen PDF-Texte (de/en) liegen in `layout.rs`.
4. **Erste Vorlagen**: `avery-3474` (70×37 mm, 3×8, oberer Rand 0,5 mm, Innenabstand 4 mm), `scan-list` (Tabelle mit 18-mm-QR-Codes, 10 Zeilen pro Seite) und `qr-cards` (bisheriges Layout).
5. Die alten Endpunkte `/api/collection/qr-codes/all|selected` und `qr_pdf_service` entfallen. Im Frontend ersetzt ein gemeinsamer Druck-Dialog die bisherigen QR-Buttons.

## Konsequenzen

### Positive Effekte
* Eine neue Vorlage besteht aus einem Renderer, einem Enum-Wert und einem Eintrag im Druck-Dialog.
* Alle Vorlagen unterstützen dieselben Umfänge, auch die Filter der Sammlungsansicht.
* Geometrie-Invarianten (QR-Mindestgröße, Innenabstand) sind als Compile-Zeit-Asserts abgesichert.

### Nachteile & Risiken
* **Breaking Change der API**: Die alten QR-Endpunkte entfallen. Einziger Nutzer war das eigene Frontend, das gleichzeitig ausgeliefert wird.
* **Druckerränder und Skalierung**: Etiketten passen nur bei 100 % Druckgröße. Der Dialog weist darauf hin; der Innenabstand puffert Abweichungen.
* **Builtin-Fonts**: Zeichen außerhalb von WinAnsi (z. B. Japanisch) erscheinen als „?“ – wie bei den übrigen PDFs.
