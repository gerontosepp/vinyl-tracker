---
name: ticket-workflow
description: >-
  Standardisierter End-to-End-Ablauf zur Bearbeitung, Implementierung, Validierung,
  Dokumentation, Zusammenführung und Schließung von GitHub-Issues und Tickets in Vinyl Tracker.
---

# Vinyl Tracker Ticket Workflow Skill

Dieser Skill beschreibt den vollständigen Standard-Workflow zur Abarbeitung eines GitHub-Issues/Tickets in Vinyl Tracker – von der Ticket-Analyse bis zum Schließen des Tickets.

---

## 1. Ticket-Analyse & Vorbereitung

1. **Ticket-Details abrufen**:
   ```bash
   gh issue view <ISSUE_ID>
   ```
2. **Anforderungen & Akzeptanzkriterien erfassen**:
   - Was soll fachlich und technisch erreicht werden?
   - Welche Komponenten sind betroffen (Backend, Frontend, DB/Flyway, Discogs-API, Roon-API)?
   - Bei unklaren Anforderungen oder Design-Entscheidungen gezielt Rücksprache mit dem Nutzer halten (z. B. via `ask_question`).

---

## 2. Branching & Workspace-Vorbereitung

1. **Basis aktualisieren**:
   Immer von einem aktuellen `develop`-Branch starten:
   ```bash
   git checkout develop
   git pull origin develop
   ```

2. **Feature-Branch erstellen**:
   Namenskonventionen:
   - Features: `feat/<ISSUE_ID>-<kurzbeschreibung>` (z. B. `feat/66-edit-conditions-discogs-sync`)
   - Bugfixes: `fix/<ISSUE_ID>-<kurzbeschreibung>`
   - Refactorings/Chores: `chore/<ISSUE_ID>-<kurzbeschreibung>`

   ```bash
   git checkout -b feat/<ISSUE_ID>-<kurzbeschreibung>
   ```

---

## 3. Implementierungs-Standards (Rules)

### Backend (Java 25 & Spring Boot 4.x)
- **Architektur**: Strikte Schichtenarchitektur (Controller -> Service -> Repository).
- **Lombok**: Boilerplate via `@Data`, `@RequiredArgsConstructor`, `@Builder`, etc.
- **DTOs & Serialisierung**: Sprechende DTOs für API-Payloads. JSON-Properties snake_case (`@JsonProperty("media_condition")`).
- **Datum & Uhrzeit**: Immer ISO-8601 in **UTC** (`LocalDateTime` mit `Z`-Suffix oder `UTC_FORMATTER`).
- **CORS & HTTP-Methoden**: Bei neuen HTTP-Methoden (z. B. `PATCH`) sicherstellen, dass sie in `AppConfig.java` in `allowedMethods` freigeschaltet sind.
- **Resilienz & Caching**: Externe API-Aufrufe (Discogs, Roon) mit Rate-Limiter (`@RateLimiter`), Retry und Caching (`@Cacheable`) absichern.
- **Fehlerbehandlung**: Aussagekräftige structured `ProblemDetail`-Responses bei Fehlern.

### Frontend (Angular 19 & Standalone Components)
- **Reaktivität**: Angular Signals (`signal()`, `computed()`, `update()`) für State Management.
- **Styling**: Tailwind CSS Utility-Klassen. Kein manuelles CSS außer für komplexe Animationen.
- **Lokalisierung**: Mehrsprachigkeit über `LanguageService` / Übersetzungsschlüssel pflegen (`de` & `en`).
- **Datum & Uhrzeit**: Backend liefert UTC; Frontend wandelt in lokale Zeit um.
- **Feedback**: API-Aktionen immer mit visuellen Rückmeldungen (Toasts via `ToastService`, Ladeindikatoren) begleiten.

---

## 4. Tests & Quality Gates (Mandatory)

Vor der Fertigstellung müssen **alle** Tests lokal erfolgreich ausgeführt werden:

1. **Backend Tests**:
   ```bash
   JAVA_HOME=/opt/homebrew/opt/openjdk@25 mvn test
   ```
   - Neue Unit- & Integrationstests für alle geänderten Services und Controller.
   - Mindestens **> 80%** Testabdeckung (JaCoCo).
   - Tests dürfen weder fehlschlagen noch auskommentiert/geskippt werden.

2. **Frontend Tests**:
   ```bash
   cd frontend
   npm test -- --watch=false
   npm run build
   cd ..
   ```
   - Alle Karma/Jasmine Unit-Tests müssen bestehen.
   - Keine TypeScript-Kompilierungsfehler (`tsc`).

---

## 5. Dokumentations-Sync (Live Docs)

Dokumentation **sofort** zusammen mit dem Code aktualisieren:

1. **`README.md`**:
   - Neue Features, geänderte Abläufe, Konfigurationen oder Endpunkte sofort eintragen.
2. **`docs/arc42.md`**:
   - Bei relevanten Architektur-, Schnittstellen- oder Datenmodell-Änderungen das entsprechende Szenario (Kapitel 6) oder Bausteine (Kapitel 5) erweitern.

---

## 6. Bereitstellung & Nutzertest

1. **Docker-Container aktualisieren**:
   Geänderte Container bauen und neu starten:
   ```bash
   docker compose up -d --build backend frontend
   ```
2. **Nutzer zum Testen einladen**:
   - Dem Nutzer kurz zusammenfassen, was implementiert wurde.
   - Test-URL nennen (`https://localhost:5173`).
   - Nutzer testen lassen und Feedback abwarten (**kein vorzeitiges Mergen ohne Bestätigung!**).

---

## 7. Commit, Merge & Cleanup

Sobald der Nutzer das Go gibt:

1. **Conventional Commit**:
   ```bash
   git add .
   git commit -m "feat: <kurze Beschreibung> (#<ISSUE_ID>)

   - Detaillierter Aufzählungspunkt 1
   - Detaillierter Aufzählungspunkt 2"
   ```

2. **In `develop` mergen**:
   ```bash
   git checkout develop
   git pull origin develop
   git merge feat/<ISSUE_ID>-<kurzbeschreibung> --no-ff -m "Merge branch 'feat/<ISSUE_ID>-<kurzbeschreibung>' into develop"
   ```

3. **Remote aktualisieren**:
   ```bash
   git push origin develop
   ```

4. **Feature-Branch aufräumen**:
   ```bash
   git branch -d feat/<ISSUE_ID>-<kurzbeschreibung>
   ```

---

## 8. Ticket schließen

Das GitHub-Ticket über das GitHub CLI schließen und eine prägnante Zusammenfassung der Lösung hinterlassen:

```bash
gh issue close <ISSUE_ID> --comment "Erfolgreich umgesetzt und in develop gemergt: <Zusammenfassung der Lösung>."
```
