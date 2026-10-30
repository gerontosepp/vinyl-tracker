## 1. Backend
- [x] 1.1 `ScanRequest.identify` (Standard `false`), `process_scan`/`log_local` ohne `listen_event` im Identify Mode
- [x] 1.2 Tests: kein `listen_event` mit `identify`, Standardverhalten unverändert

## 2. Frontend
- [x] 2.1 `ScannerService.identifyMode` + Toggle im Scanner, `identify` im API-Aufruf
- [x] 2.2 Scanner meldet gefundene Platte, Dashboard öffnet das Detail-Modal; Scanner bleibt bereit
- [x] 2.3 Lightbox für das Cover im Detail-Modal (Klick, Esc)
- [x] 2.4 Übersetzungen `de`/`en`, Tooltips
- [x] 2.5 Unit-Tests (Scanner, Dashboard, Modal)

## 3. Doku
- [x] 3.1 Specs `scanner` und `collection`, Help (DE/EN), README, Release-Info
- [ ] 3.2 Lokalen Stack aktualisieren und prüfen
