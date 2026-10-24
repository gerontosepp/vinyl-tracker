# ADR-0022: Label-Erkennung in der App über OpenRouter

* **Status:** Accepted
* **Datum:** 2026-10-23
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#235](https://github.com/gerontosepp/vinyl-tracker/issues/235), OpenSpec-Change `235-label-photo-auto-identification`; ergänzt [ADR-0021](0021-label-erkennung-ueber-mcp-und-label-inbox.md)

---

## Kontext & Problemstellung

Die Erkennung per Label-Foto (ADR-0021) funktioniert zuverlässig, verlangt aber einen manuellen Schritt: In Claude Desktop/Code muss der MCP-Prompt `process_label_inbox` gestartet werden. Gewünscht ist, dass die App ein fotografiertes Label selbst erkennt und den Treffer nur noch zur Bestätigung vorlegt – auch unterwegs am Handy.

## Entscheidungstreiber

* Erkennung ohne Wechsel in Claude Desktop/Code, direkt nach dem Foto.
* Freie Modellwahl und überschaubare Kosten pro Foto.
* Keine Aktion ohne Bestätigung des Nutzers; ein Modell darf die Sammlung nicht verändern.
* Der MCP-Weg mit Claude-Abo bleibt als kostenfreie Alternative erhalten.

## Betrachtete Optionen

* **Option 1: Anthropic Messages API direkt** – ein Anbieter, ein Key, aber auf Claude-Modelle festgelegt.
* **Option 2: OpenRouter (gewählt)** – OpenAI-kompatible Chat-Completions-API mit Bild-Input und Tool-Calling vor vielen Anbietern; Modell per Einstellung wählbar (Standard `anthropic/claude-sonnet-5.5`, günstig z. B. `anthropic/claude-haiku-5.5`).
* **Option 3: Weiter nur MCP** – keine Kosten, aber kein Komfortgewinn.

## Entscheidung

Option 2:

1. **Pro Nutzer konfigurierbar:** API-Key und Modell unter Einstellungen (`GET`/`PUT /api/users/me/openrouter`). Der Key wird wie der Discogs-Token mit AES-256-GCM verschlüsselt (`app_user.openrouter_api_key`) und nie ausgeliefert. Ohne Key bleibt alles wie bisher.
2. **Automatisch nach dem Upload:** Ist ein Key hinterlegt, setzt `POST /api/label-photos` das Foto auf `identify_state = queued` und startet die Erkennung im Hintergrund (höchstens zwei parallel, Semaphore in `AppState`). Abgebrochene Läufe werden beim Neustart zu `error`; `POST /api/label-photos/{id}/identify` stellt erneut ein.
3. **Agenten-Schleife mit nur lesenden Tools:** Das Modell bekommt das Foto, die gemeinsame Leseanleitung (`LABEL_READING_STEPS`, auch von den MCP-Prompts genutzt) und die Tools `search_discogs`, `get_record_details` und `submit_identification` (höchstens 8 Runden).
4. **Schutz vor erfundenen Treffern:** Vorgeschlagene Discogs-IDs müssen in derselben Erkennung von einem Tool zurückgegeben worden sein, sonst gilt die Erkennung als fehlgeschlagen.
5. **Bestätigung in der Label-Inbox:** Das Ergebnis (bester Treffer, Alternativen, Sicherheit, Begründung, Hinweis auf ein weiteres Foto) wird angereichert in `label_photo.suggestion` (JSONB) gespeichert. Hinzufügen bzw. Abschließen erfolgt erst per Klick über die bestehenden Endpunkte (`POST /api/collection/releases/{id}`, `PATCH /api/label-photos/{id}`).

## Konsequenzen

### Positive Effekte
* Foto aufnehmen, später in der Inbox nur noch bestätigen – ohne Claude Desktop/Code.
* Modell und Kosten frei wählbar; MCP-Weg und Abo-Nutzung bleiben erhalten.
* Prompt-Injection über Label-Text ist unkritisch, da das Modell nur lesen und vorschlagen kann.

### Nachteile & Risiken
* **Kosten:** Pro Foto fallen API-Kosten an (meist wenige Cent, abhängig vom Modell).
* **Datenschutz:** Label-Fotos gehen an OpenRouter und den Modellanbieter; die Einstellungen weisen darauf hin.
* **Abhängigkeit:** Fällt OpenRouter aus, landet das Foto im Zustand `error` und kann erneut erkannt oder über MCP bearbeitet werden.
