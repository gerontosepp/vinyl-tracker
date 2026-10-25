# Proposal: Manuelle Platten bei Discogs prüfen und übernehmen – Etappe 2 (#243)

## Why

Seit Etappe 1 (#242, ADR-0023) verwaltet Vinyl Tracker Platten ohne Discogs-Eintrag lokal mit negativen IDs. Wird eine solche Platte später bei Discogs eingetragen (vom Nutzer selbst oder von jemand anderem), bleibt sie heute für immer „manuell“: kein Discogs-Preis, keine Discogs-Daten, kein Eintrag in der Discogs-Sammlung. Der Nutzer braucht einen Weg, den Release zu finden und die Platte ohne Verlust von Hör-Historie und Regalplatz in eine normale Discogs-Platte umzuwandeln.

## What Changes

- **„Bei Discogs prüfen“** in der Detailansicht einer manuellen Platte: Das Backend sucht nacheinander per Barcode, Katalognummer + Label und Künstler + Titel und liefert die zusammengeführten Kandidaten. Die Darstellung entspricht den Kandidaten der Label-Inbox; je Kandidat wird angezeigt, ob der Release bereits in der eigenen Sammlung ist.
- **Übernahme nur nach Bestätigung:** Der Nutzer wählt einen Kandidaten und bestätigt. Das Backend fügt den Release der Discogs-Sammlung hinzu und macht aus der manuellen Platte eine Discogs-Platte mit echter Release- und Exemplar-ID. Hör-Historie, Regalplatz, Zustände und eigener Sortier-String bleiben erhalten.
- **Cover und Wert von Discogs:** Das eigene Cover wird gelöscht, das Discogs-Bild angezeigt; der eigene Wert wird durch den Discogs-Preis ersetzt (Preis-Refresh).
- **Release schon als Discogs-Exemplar vorhanden:** Der Dialog bietet die Wahl. Standard ist ein zweites Exemplar (neue Instanz bei Discogs). Optional „Zusammenführen“: Die Hör-Historie wandert zum vorhandenen Exemplar, die manuelle Platte wird gelöscht, bei Discogs wird nichts hinzugefügt.
- **Alte negative ID bleibt auflösbar:** Regalgrenzen (`storage_boundary.instance_id`) werden in derselben Transaktion umgeschrieben. Eine neue Alias-Tabelle bildet die alte ID auf das Exemplar ab, damit gedruckte QR-Etiketten `discogs-id:-n` weiter funktionieren.
- **„Bei Discogs eintragen“:** Link zum Discogs-Formular „Add Release“ plus kopierbarer Text mit den Daten der Platte (Discogs kann das Formular nicht per URL vorausfüllen).
- **MCP:** neue Tools `create_manual_record`, `check_manual_record` und `take_over_manual_record`; Letzteres nur nach ausdrücklicher Bestätigung des Nutzers.

Nicht im Umfang (abweichend vom Issue-Text): **keine automatische Prüfung beim Discogs-Sync**. Geprüft wird nur auf Knopfdruck in der Detailansicht bzw. per MCP. Die Übernahme lässt sich nicht rückgängig machen.

## Capabilities

### New Capabilities
<!-- keine -->

### Modified Capabilities
- `collection`: manuelle Platten bei Discogs prüfen, übernehmen (zweites Exemplar oder Zusammenführen), alte QR-IDs per Alias auflösen, Link „Bei Discogs eintragen“.
- `mcp`: Tools zum Anlegen, Prüfen und Übernehmen manueller Platten.

## Impact

- **Backend:** Migration `15_add_manual_record_alias.sql`; neuer `manual_takeover_service.rs` (Kandidatensuche, Übernahme in einer Transaktion); neue Endpunkte `GET /api/records/{id}/discogs-candidates` und `POST /api/records/{id}/takeover`; `scan_service.rs` (Alias-Auflösung); `collection_sync.rs` (Hinzufügen zur Discogs-Sammlung und Release-Upsert wiederverwendbar machen); Backup/Restore um Aliase erweitern; DTOs in `vinyl-api-types`.
- **Frontend:** `record-detail-modal` (Buttons „Bei Discogs prüfen“ und „Bei Discogs eintragen“, Kandidatenliste, Bestätigungsdialog mit Modus-Wahl), Übersetzungen, Hilfe.
- **MCP-Server:** drei neue Tools in `mcp/src/server.rs`, Client-Methoden, Vertragstests.
- **Discogs-API:** bis zu drei Suchanfragen pro Prüfung sowie ein Hinzufügen und ein Release-Abruf pro Übernahme (innerhalb des Ratenlimits von 60/min).
- **Doku:** ADR-0023 um die Übernahme ergänzen, README, arc42, Release-Info, In-App-Hilfe.
