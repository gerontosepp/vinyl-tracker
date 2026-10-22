# Proposal: Label-Inbox in der PWA bearbeiten (#218)

## Why

Die Label-Inbox ließ sich bisher nur über MCP abarbeiten. Fehlaufnahmen, doppelte oder nicht mehr benötigte Fotos konnte der Nutzer in der App weder sehen noch entfernen.

## What Changes

- Neue Ansicht `/label-inbox`: Raster der offenen Fotos mit Aufnahmedatum, Bild in voller Größe per Klick, Löschen einzeln und „Alle löschen“ mit Bestätigung.
- Das Inbox-Badge auf der Scan-Seite schließt den Scanner und öffnet die Ansicht.
- Backend: `DELETE /api/label-photos` löscht alle Fotos des Nutzers, mit `?status=pending` nur die offenen; Antwort `{ deleted, pendingCount }`.

## Capabilities

### Modified Capabilities
- `label-photo`: Inbox in der PWA ansehen und bereinigen.

## Impact

- Backend: `LabelPhotoService::delete_all`, Route `DELETE /api/label-photos`, DTO `LabelPhotoDeleteDto`.
- Frontend: Komponente `LabelInboxComponent`, Route, `ApiService`, Badge in `LabelPhotoCaptureComponent`, Übersetzungen.
