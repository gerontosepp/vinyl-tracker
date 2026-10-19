---
name: adr-management
description: >-
  Standardized procedure for creating, updating, superseding, and indexing
  Architecture Decision Records (ADRs) in Vinyl Tracker.
---

# Vinyl Tracker ADR Management Skill

This skill defines the standardized procedure for authoring, maintaining, and indexing **Architecture Decision Records (ADRs)** in Vinyl Tracker.

---

## 1. When to Write an ADR

An ADR must be created whenever a significant technical or architectural decision is made, including:
- **Framework & Technology Selection**: Adopting, replacing, or removing core libraries, frameworks, or engines (e.g. Axum, Angular, SQLx, SQLite/PostgreSQL, Roon MOO).
- **Security & Data Protection**: Encryption mechanisms (e.g. AEAD AES-256-GCM), token management, SSRF protection, authentication, CORS policies.
- **Cross-Cutting Concerns & Patterns**: Error handling (RFC 7807), caching strategies (Moka, client cache), rate limiting (Governor), state management (Signals).
- **External System Integrations**: Protocols and data flow for hardware scanners (HID Keyboard Wedge), Discogs API, Roon WebSocket, Model Context Protocol (rmcp).
- **Data Modeling & Domain Logic**: Natural collation/sorting algorithms, grading-based market valuation models, export/backup formats (CSV, JSON, PDF).
- **Build & Infrastructure**: Multi-architecture container build strategy (`cargo-chef`, `$BUILDPLATFORM`), CI/CD gates, test coverage thresholds.

---

## 2. ADR Lifecycle & Statuses

* **`Proposed`**: The decision has been drafted and is under review/discussion.
* **`Accepted`**: The decision is approved and actively implemented or in production.
* **`Rejected`**: The decision was evaluated and rejected in favor of another approach.
* **`Deprecated`**: The decision is no longer active and has not been directly superseded.
* **`Superseded by ADR-YYYY`**: The decision was replaced by a subsequent decision (`ADR-YYYY`).

---

## 3. Procedure for Creating a New ADR

### Step 1: Determine the Next Number
List existing ADRs to find the next sequential 4-digit number:
```bash
ls -1 docs/adr/[0-9][0-9][0-9][0-9]-*.md | sort | tail -n 1
```
For example, if the latest is `docs/adr/0013-...`, the next is `0014`.

### Step 2: Create the ADR Document
Create `docs/adr/XXXX-<kebab-case-titel>.md` using the standard MADR/Nygard structure:

```markdown
# ADR-XXXX: [Prägnanter Titel]

* **Status:** Accepted
* **Datum:** YYYY-MM-DD
* **Beteiligte:** [Entwickler / Rollen]
* **Kontextbezug:** [GitHub Issue #...]

---

## Kontext & Problemstellung

[Welches Problem soll gelöst werden? Technische, fachliche oder operative Rahmenbedingungen.]

## Entscheidungstreiber

* [z. B. Performance, Sicherheit, Wartbarkeit, Entwicklungsgeschwindigkeit, UX]

## Betrachtete Optionen

* **Option 1:** [Beschreibung]
* **Option 2:** [Beschreibung]

## Entscheidung

Wir haben uns für **Option X** entschieden, weil:
1. [Begründung 1]
2. [Begründung 2]

## Konsequenzen

### Positiv
* [Vorteil 1]
* [Vorteil 2]

### Negativ / Trade-offs
* [Nachteil / Herausforderung 1]
* [Mitigationsstrategie]

## Technische Umsetzung & Referenzen

* Implementierung: `[Pfad]`
* Verwandte Komponenten: `[Komponenten]`
```

### Step 3: Update Index & References
1. **`docs/adr/README.md`**:
   Add the new entry to the ADR index table:
   ```markdown
   | [ADR-XXXX](XXXX-<kebab-case-titel>.md) | [Titel] | `Accepted` | YYYY-MM-DD |
   ```
2. **`docs/arc42.md`**:
   Add the link under Section 9 ("Architekturentscheidungen").
3. **`docs/Release-Info.md`**:
   Add an entry under `## Unreleased` and sync via:
   ```bash
   node scripts/sync-release-info.js
   ```

---

## 4. Superseding an Existing ADR

When a decision replaces an earlier ADR:
1. Update the original ADR's status:
   `* **Status:** Superseded by [ADR-YYYY](YYYY-<titel>.md)`
2. Add a note in the original ADR referencing the successor and explaining the shift.
3. In the new ADR (`ADR-YYYY`), reference the superseded ADR under *Kontext & Problemstellung*.
4. Update the status column in `docs/adr/README.md` to `Superseded by ADR-YYYY`.
