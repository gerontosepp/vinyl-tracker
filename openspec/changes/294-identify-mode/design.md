# Design: Identify Mode (#294)

## Backend
`ScanRequest` bekommt `identify: bool` (`#[serde(default)]`, bestehende Clients bleiben unverändert). `ScanService::process_scan` reicht das Flag an die beiden Stellen, die ein `listen_event` schreiben (`log_local` und der Discogs-Pfad). Die Meldung lautet im Identify Mode „Found: …“ statt „Now playing: …“. Das Ergebnis bleibt `ScanResultDto` mit `record.discogsId`, das Frontend lädt die Details danach über `GET /api/records/{id}` wie beim Klick in der Liste. Kein neuer Endpunkt.

Hinweis: Der Discogs-Pfad legt weiterhin den `record_cache`-Eintrag an, wenn die Platte im Bestand ist (Cache, keine Nutzerdaten).

`RecordDetailDto` bekommt `cover_url`: das primäre Bild des Discogs-Releases (`images[]`, volle Auflösung), sonst `thumb_url` (bei manuellen Platten ist das schon das eigene Cover). Die Lightbox nutzt `cover_url`, dann `cover_image` der Liste, dann das Thumbnail.

## Frontend
- `ScannerService.identifyMode` (Signal, `localStorage` `scanner_identify`).
- `BarcodeScannerComponent`: Toggle über dem Scanbereich; sendet `identify` mit; bei Erfolg im Identify Mode gibt es das Output `identified` (`RecordRef`) und der Scanner setzt sich zurück, bleibt also bereit. Kein „Zur Sammlung hinzufügen“/Hör-Toast.
- `DashboardComponent` hostet Scanner und Detail-Modal bereits: es hört auf `identified` und ruft `openRecord(ref)` auf. Das Modal liegt über dem Scanner; nach dem Schließen ist der Scanner sofort wieder bereit.
- `RecordDetailModalComponent`: Cover im Header wird zum Button, der ein Lightbox-Overlay (`z-[70]`) mit `cover_image` öffnet. Esc schließt zuerst die Lightbox, dann das Modal.

## Entscheidungen
- Flag am bestehenden Endpunkt statt neuem Endpunkt: Lookup-Logik (Barcode-Varianten, QR, Alias, Discogs) bleibt an einer Stelle.
- Kein MCP-Change: `scan_barcode` behält sein Verhalten.
