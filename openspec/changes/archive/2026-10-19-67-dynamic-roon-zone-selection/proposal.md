# Proposal: Dynamic Roon Zone Selection

## Why
Currently, triggering album playback via "Auf Roon abspielen" (Play on Roon) in the Record Detail Modal always routes to the user's statically configured default zone in user settings. Users with multiple active Roon audio zones (e.g., Living Room, Office, Headphones, Patio) cannot choose a specific target zone ad-hoc when playing a record.

## What Changes
1. **Frontend UI in Record Detail Modal (`record-detail-modal.component.ts` & template)**:
   - Provide dynamic zone selection when initiating playback on Roon (e.g. dropdown / split-button or zone selection popover).
   - Dynamically load available active zones from `/api/roon/zones` via `ApiService.getRoonZones()`.
   - Pre-select the user's configured default zone or last selected zone for the current session.
   - Pass the chosen `zone_id` to `ApiService.playOnRoon({ recordId, zoneId })`.
2. **Backend Playback Verification (`backend/src/routes/roon.rs` & `backend/src/services/roon/`)**:
   - Ensure `POST /api/roon/play` reliably routes to `zone_id` when supplied in `RoonPlayRequestDto`.
   - Maintain robust fallback to user's default zone if no `zone_id` is supplied.
3. **Session Memory & UX**:
   - Remember the last chosen playback zone for the session in a signal or local storage.
   - Internationalize all new UI elements in German and English via `LanguageService`.
4. **Testing**:
   - Unit tests for component zone selection in Angular Karma tests.
   - Backend unit/integration tests for play request zone routing.
