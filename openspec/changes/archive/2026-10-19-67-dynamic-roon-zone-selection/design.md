# Design: Dynamic Roon Zone Selection

## Architecture & Data Flow

```
[Record Detail Modal]
        │
        ├── 1. getRoonZones() ──► GET /api/roon/zones ──► RoonService (Zone Cache)
        │                                                     │
        │   ◄── returns RoonZone[] ───────────────────────────┘
        │
        ├── 2. User selects target zone (or default/last used)
        │
        └── 3. playOnRoon(recordId, zoneId) ──► POST /api/roon/play
                                                        │
                                                        ├── Explicit zoneId provided?
                                                        │   YES: use zoneId
                                                        │   NO: fallback to user default roon_zone_id
                                                        │
                                                        └── Send MOO Play Command to Roon Core
```

## Component Changes

### Frontend
- **`RecordDetailModalComponent`**:
  - Add signal `roonZones = signal<RoonZone[]>([])`
  - Add signal `selectedZoneId = signal<string | null>(null)`
  - Add signal `isZoneMenuOpen = signal<boolean>(false)`
  - On modal open / when Roon is connected: fetch available zones via `apiService.getRoonZones()`.
  - Determine initial selection: session-cached zone ID -> user settings default zone ID -> first available zone.
  - UI: Convert the "Auf Roon abspielen" button into a split-button or trigger with a dropdown menu displaying zone names and their playback state (`playing`, `paused`, `stopped`).
  - Upon selecting a zone from the dropdown, immediately play or remember the selection.
  - When primary "Auf Roon abspielen" button is clicked: play directly to `selectedZoneId()`.

### Backend
- Verify `backend/src/services/roon/service.rs`:
  - `play_record`: when `req.zone_id` is `Some(...)`, resolve that zone from the zone list; fallback to `settings.roon_zone_id`.
  - Assert in unit/integration tests that zoneId parameter is prioritized.

### Internationalization
- Add translation keys in `LanguageService` (DE & EN):
  - `recordDetail.playOnRoonZone`: "Abspielen auf..." / "Play on..."
  - `recordDetail.selectZone`: "Zone wählen" / "Select Zone"
  - `recordDetail.defaultZone`: "(Standard)" / "(Default)"
