# ADR-0021: Label-Erkennung über MCP mit Label-Inbox statt Claude API im Backend

* **Status:** Accepted
* **Datum:** 2026-10-22
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#208](https://github.com/gerontosepp/vinyl-tracker/issues/208), OpenSpec-Change `208-label-photo-identification`

---

## Kontext & Problemstellung

Ältere Platten haben oft keinen Barcode, der Barcode-Scan findet sie nicht. Claude kann eine Pressung anhand eines Fotos des Platten-Labels (Künstler, Titel, Label, Katalognummer, Land, Jahr, Matrix) erkennen. Die Frage ist, wie Foto und Claude zusammenkommen – idealerweise mit dem vorhandenen Claude-Abo des Nutzers und vom Handy aus, das ohnehin am Plattenregal ist.

## Entscheidungstreiber

* Keine laufenden API-Kosten und kein Anthropic API-Key im Tracker; ein Claude-Abo (Pro/Max) ist kein API-Zugang für Drittanwendungen.
* Fotografieren am Handy, Erkennung gern später und im Stapel.
* Kein öffentlich erreichbarer Dienst und keine zusätzliche Angriffsfläche.
* Der Nutzer bestätigt jeden Treffer, bevor etwas in die Sammlung kommt.

## Betrachtete Optionen

* **Option 1: Claude API im Backend** – Foto-Upload, Backend ruft die Messages API mit Bild und strukturierter Ausgabe auf. Komfortabel in der App, aber API-Key und Kosten pro Erkennung.
* **Option 2: Remote-MCP-Server** – HTTP-Transport mit OAuth, öffentlich erreichbar, damit die Claude-Mobile-App direkt fotografieren kann. Größter Aufwand und größere Angriffsfläche.
* **Option 3: Lokaler MCP-Server mit Label-Inbox (gewählt)** – Fotos werden in der PWA aufgenommen und im Backend gespeichert. Claude Desktop/Code holt sie über das stdio-MCP als Bild-Inhalt ab und erkennt sie mit dem Abo.

## Entscheidung

Option 3:

1. **Strukturierte Discogs-Suche:** `GET /api/discogs/search` und `search_discogs` reichen `catno`, `label`, `artist`, `release_title`, `year`, `country`, `format` an Discogs durch; Suchergebnisse enthalten die Labels, Release-Details die Identifiers (Matrix/Runout, Label Code, Rights Society).
2. **Label-Inbox:** `POST /api/label-photos` nimmt JPEG/PNG (max. 15 MB) an. Das Backend wendet die EXIF-Orientierung an, verkleinert auf höchstens 1568 px lange Kante und speichert ein neu kodiertes JPEG ohne Metadaten als `BYTEA` in `label_photo` (Status `pending` | `identified` | `failed`). Die PWA verkleinert schon vor dem Upload per Canvas (spart Datenvolumen, wandelt HEIC in JPEG).
3. **Speicherort Datenbank:** Die Fotos liegen in PostgreSQL statt im Dateisystem – kein zusätzliches Docker-Volume, der Datenbank-Dump sichert sie mit. Bei einigen hundert KB pro Foto und überschaubarer Anzahl ist das unkritisch.
4. **MCP:** `get_label_inbox` liefert offene Fotos als `image`-Content (Base64), `resolve_label_photo` schließt sie ab. Die Prompts `identify_record_from_label` und `process_label_inbox` geben Claude den Ablauf vor und verlangen die Bestätigung des Nutzers vor `add_to_collection` bzw. `scan_barcode`.

## Konsequenzen

### Positive Effekte
* Keine API-Kosten und keine Secrets im Tracker; das Abo des Nutzers reicht.
* Fotografieren am Handy und Erkennen im Stapel sind entkoppelt.
* Die strukturierte Suche und die Identifiers helfen auch ohne Foto (z. B. Suche nach Katalognummer).

### Nachteile & Risiken
* **Zwei Geräte/Schritte:** Die Erkennung läuft in Claude Desktop/Code, nicht in der App selbst.
* **Claude-Mobile-App:** kann den lokalen stdio-Server nicht nutzen; dafür wäre ein Remote-MCP nötig (Option 2).
* **Datenbankgröße:** Fotos wachsen mit; erledigte Fotos lassen sich über `DELETE /api/label-photos/{id}` entfernen.
