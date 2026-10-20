# ADR-0020: Lagerposition aus gespeicherten Fachgrenzen

* **Status:** Accepted
* **Datum:** 2026-10-20
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#41](https://github.com/gerontosepp/vinyl-tracker/issues/41), OpenSpec-Change `41-storage-location`

---

## Kontext & Problemstellung

Der Tracker soll wissen, in welchem Regal und Fach eine Platte steht, und beim Hinzufügen sagen, wohin eine neue Platte gehört. Die Lagerung besteht aus Regalen mit Fach-Raster (IKEA Kallax für Platten, IKEA-CD-Regal für CDs) und einer Kapazität pro Fach. Die Platten stehen in Regal-Sortierung (Künstler A–Z ohne „The“, Jahr, Titel). Platten kommen über die App und über den Discogs-Sync hinzu. Eine manuelle Pflege des Lagerorts pro Platte ist nicht gewünscht.

## Entscheidungstreiber

* Neue Platten dürfen keine Kaskaden auslösen, bei denen viele Platten ein Fach weiterwandern.
* Die Regale sollen gleichmäßig gefüllt sein, damit jedes Fach Luft für neue Platten hat.
* Änderungen außerhalb der App (Discogs-Sync, Wiederherstellung) müssen genauso einsortiert werden.
* Wenig gespeicherter Zustand, der veralten kann.

## Betrachtete Optionen

* **Option 1: Position fortlaufend berechnen** – Fächer der Reihe nach füllen (erst Regal 1 voll, dann Regal 2). Nichts zu speichern, aber jede neue Platte verschiebt alle folgenden Platten.
* **Option 2: Gleichverteilung bei jeder Anfrage neu berechnen** – Füllgrad überall gleich, aber jede Änderung verschiebt viele Fachgrenzen um je eine Platte.
* **Option 3: Position pro Exemplar speichern** – stabil, aber muss bei Sync, Hinzufügen, Entfernen und Konfigurationsänderungen gepflegt werden.
* **Option 4: Fachgrenzen speichern, Position daraus berechnen (gewählt)** – wie im echten Regal: Die Trenner bleiben stehen, neue Platten kommen dazwischen.

## Entscheidung

Option 4:

1. **„Neu verteilen“** verteilt die Exemplare eines Mediums gleichmäßig (Füllgrad im Verhältnis zur Kapazität) auf alle Fächer aller Regale und speichert pro Fach den Sortierschlüssel der ersten Platte (`storage_boundary`). Automatisch beim ersten Regal und bei Strukturänderungen (Regal hinzu/weg, Reihenfolge, Raster), sonst manuell mit Vorschau.
2. **Einsortieren:** Jedes Exemplar liegt in dem Fach, in dessen Grenzbereich sein Sortierschlüssel fällt. Neue oder entfernte Platten verschieben nichts, solange kein Fach überläuft.
3. **Ausgleich:** Läuft ein Fach über, wandern Randplatten zum nächstgelegenen Fach mit Platz (weniger Schritte gewinnt, bei Gleichstand nach rechts). Ohne freien Platz sind die letzten Exemplare „ohne Platz“.
4. **Speichern:** Lesende Endpunkte berechnen nur. Nach Hinzufügen, Discogs-Sync und Wiederherstellung speichert `StorageService::commit` die ausgeglichenen Grenzen. Der Einsortier-Hinweis vergleicht die Belegung ohne und mit der neuen Platte.
5. **Sortierschlüssel:** Die Schlüssel kommen aus SQL (`shelf_order_sql`), der Vergleich in Rust ist byteweise und entspricht damit `COLLATE "C"`. Die Sammlungsansicht nach Künstler nutzt denselben Ausdruck.
6. **Platzbedarf:** Anzahl der Discs aus den Discogs-Formatangaben (`record_cache.disc_count`), bis zum nächsten Sync aus dem Format geschätzt („Double …“ = 2).

Die Berechnung (`services/storage/layout.rs`) ist rein und deterministisch und vollständig über Unit-Tests abgesichert.

## Konsequenzen

### Positive Effekte
* Neue Platten bewegen höchstens die Platten bis zum nächsten Fach mit Platz, meist gar keine.
* Der Hinweis nennt genau die Platten, die umgestellt werden müssen.
* Sync und Wiederherstellung sortieren genauso ein wie das Hinzufügen in der App.

### Nachteile & Risiken
* **Gespeicherter Zustand:** Grenzen können zur Sammlung „veralten“ (z. B. nach vielen Entfernungen), die Füllung wird ungleich. „Neu verteilen“ behebt das, die Übersicht zeigt die Füllstände.
* **Sortierung muss zum echten Regal passen:** Nur Künstler A–Z wird unterstützt.
* **Rechenaufwand:** Jede Anfrage mit Lagerplatz berechnet die Belegung eines Mediums (linear, bei 20 000 Exemplaren im Millisekundenbereich). Bei Bedarf später ein Cache pro Nutzer.
