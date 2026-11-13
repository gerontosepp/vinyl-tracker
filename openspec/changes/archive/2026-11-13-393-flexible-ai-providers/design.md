# Design: Anbieterunabhängige KI-Verbindungen

## Context

Siehe `proposal.md` für Motivation und `specs/` für das Verhalten. Ausgangslage:

- `OpenRouterClient` (`backend/src/clients/openrouter.rs`) spricht fest `/chat/completions` mit Bearer-Auth an; `AppState.openrouter` ist ein Singleton mit globaler Base-URL aus `OPENROUTER_API_BASE_URL`.
- Key und Modell liegen in `app_user.openrouter_api_key` (AES-256-GCM über `CryptoService`) und `openrouter_model`.
- `OpenRouterSettingsService` kapselt Lesen/Schreiben; `LabelIdentificationService` baut daraus `IdentifyContext` und speichert das Modell in `label_photo.identify_model`.
- Die PWA hat eine dedizierte `OpenRouterSettingsComponent`; die Hilfe und README nennen OpenRouter.
- Migrationen sind unveränderlich (sqlx-Checksummen), alles läuft UTC und über `sqlx`.

## Goals / Non-Goals

**Goals:**

- Eine Daten- und Code-Struktur, die neue OpenAI-kompatible Anbieter ohne Rust-Änderung aufnimmt.
- Verlustfreier Upgrade-Pfad inklusive weiter funktionierendem Alt-Endpunkt.
- Klare Trennung von Verbindungsverwaltung, HTTP-Client und Label-Erkennung.
- Testbare Sicherheitsregeln für nutzerdefinierte URLs.

**Non-Goals:**

- Native Protokolle (Anthropic Messages, Gemini generateContent) und anbieterspezifische Features wie Prompt-Caching.
- Automatische Fallbacks, Task-Routing, Streaming oder Kostenverfolgung.
- Automatische Capability-Erkennung (Vision/Tools) jenseits des Test-Endpunkts.

## Decisions

### 1. Ein OpenAI-kompatibler Adapter statt anbieterspezifischer Clients

Alle relevanten Anbieter bieten heute einen OpenAI-kompatiblen Chat-Completions-Endpunkt mit Bild-Input und Tool-Calling (OpenAI, Anthropic, Google, Groq, Mistral, DeepSeek, OpenRouter, lokale Server). Ein generischer Client mit konfigurierbarer Base-URL, Auth-Art und Headern deckt sie ab.

*Alternativen:* (a) Native Adapter pro Anbieter – deutlich mehr Code, drei Tool-Calling-Schemata und drei Bildformate; (b) LiteLLM als vorgeschaltetes Gateway – zusätzlicher Dienst, den der Nutzer betreiben müsste. Beides ist für den aktuellen Bedarf unverhältnismäßig.

Azure OpenAI bleibt ein Sonderfall im selben Client: `api-key`-Header statt Bearer und Deployment-Pfad in der Base-URL.

### 2. Mehrere benannte Verbindungen mit einer Standard-Verbindung

Neue Tabelle `ai_connection` statt weiterer `app_user`-Spalten. Mehrere Verbindungen erlauben den Wechsel zwischen Cloud und lokal ohne erneute Key-Eingabe; genau eine ist Standard und versorgt die Label-Erkennung.

*Alternativen:* Einzelne Spalten (`ai_base_url`, `ai_key`, `ai_model`) sind einfacher, erzwingen aber beim Wechsel das Neueintippen des Keys und lassen keine lokale Testverbindung neben der produktiven zu.

Partieller Unique-Index `(user_id) WHERE is_default` erzwingt die Eindeutigkeit in der Datenbank. Das Löschen der Standard-Verbindung setzt in derselben Transaktion eine verbleibende Verbindung als Standard.

### 3. Presets als Backend-Registry

Presets (Default-Base-URL, Auth-Art, Hinweistext, ob ein Key nötig ist) liegen als statische Liste im Backend und werden über `GET /api/users/me/ai/presets` an die PWA ausgeliefert. So bleiben Defaults und Validierung an einer Stelle; die PWA muss keine URLs duplizieren.

*Alternative:* Presets nur im Frontend – dann müsste das Backend beliebige URLs ungeprüft akzeptieren und die PWA wäre die einzige Quelle für Defaults.

### 4. Authentifizierung als Daten, nicht als Code

`auth_style` ist `bearer`, `api-key-header` oder `none`. Der Client setzt daraus den passenden Header. `extra_headers` (JSONB) ist nur für unkritische Werte wie OpenRouter-Titel gedacht; Secrets gehören ausschließlich in den verschlüsselten Key.

### 5. URL-Validierung gegen SSRF

Vor dem Speichern und vor jedem Request wird die URL geparst und geprüft:

- nur `http`/`https`, keine Userinfo, kein Fragment,
- Metadata-Adressen (`169.254.169.254`, `fd00:ec2::254`) und Link-Local werden abgelehnt,
- öffentliche Hosts nur mit HTTPS; HTTP nur für Loopback und private Netze (RFC 1918, ULA),
- optionale Allowlist `AI_BASE_URL_ALLOWED_HOSTS` (kommagetrennte Hosts/Domains) für Mehrbenutzer-Deployments.

Die Prüfung ersetzt keine vollständige DNS-Rebinding-Absicherung; für die selbst gehostete Einzelnutzer-App ist das Restrisiko dokumentiert und über die Allowlist beherrschbar.

### 6. Secrets und Kompatibilität

`CryptoService` bleibt unverändert. Beim Update gilt wie bisher: `api_key` fehlt = Key behalten, leer = Key löschen. Responses liefern nur `hasApiKey`; Logs enthalten weder Key noch Authorization-Header.

Migration 18 legt `ai_connection` an, kopiert vorhandene OpenRouter-Werte (nur wenn noch keine Verbindung existiert) und ergänzt `label_photo.identify_provider`. Die alten `app_user`-Spalten bleiben mindestens ein Release erhalten, damit ein Rollback auf das vorherige Image ohne Datenverlust möglich ist. `GET`/`PUT /api/users/me/openrouter` werden auf die OpenRouter-Verbindung abgebildet; die PWA nutzt die neuen Endpunkte.

### 7. Label-Erkennung bleibt fachlich unverändert

`LabelIdentificationService` bekommt statt fester OpenRouter-Credentials die Standard-Verbindung (inkl. entschlüsseltem Key) und einen generischen Client. Die Agenten-Schleife, die Tool-Whitelist, die Verifikation der Discogs-IDs und die Bestätigung in der Inbox bleiben unverändert. Neu ist nur die Herkunft der Credentials und `identify_provider` in der Anzeige.

### 8. Fehler werden anbieterneutral abgebildet

Der Client mappt 401/403 → abgelehnter Key, 404 → Modell/Endpunkt nicht gefunden, 429 → Rate-Limit, Timeout/Transport → Erreichbarkeit. Den Provider-Body loggen wir gekürzt ohne Secrets; der Nutzer sieht eine allgemeine, handlungsorientierte Meldung.

## Risks / Trade-offs

- **SSRF über Custom-URL** → Validierung, Metadata-/Link-Local-Block, optionale Allowlist; Restrisiko dokumentiert.
- **Anbieter-Drift bei OpenAI-kompatiblen Endpunkten** → Presets, Test-Endpunkt, Modellliste; Capability-Hinweis in der UI.
- **Lokale Modelle sind langsam oder laden beim ersten Request** → 90-s-Timeout bleibt, Test-Endpunkt zeigt Timeout klar an.
- **Migration und Rollback** → Backfill idempotent (`WHERE NOT EXISTS`), alte Spalten bleiben erhalten, vor dem Deploy DB-Backup.
- **Versehentliche Key-Offenlegung** → zentrale DTOs ohne Key, Redaction in Logs, Tests prüfen, dass Responses kein `api_key` enthalten.
- **UI-Komplexität durch mehrere Verbindungen** → Liste mit klarer Standard-Markierung, Formular nur für die gewählte Verbindung, Modellliste optional.

## Migration Plan

1. Migration 18 einspielen (Tabelle, Backfill, `label_photo.identify_provider`).
2. Backend deployen; es liest bevorzugt `ai_connection` und fällt für die Erkennung auf die migrierte OpenRouter-Verbindung zurück.
3. Frontend deployen; der alte `/me/openrouter`-Endpunkt bleibt für gecachte Clients erreichbar.
4. Verifizieren: bestehender Key wird ohne Neueingabe genutzt, Test-Endpunkt und Modellliste funktionieren, neues Foto wird erkannt.
5. Rollback: vorheriges Image starten; es ignoriert Tabelle und neue Spalte, die alten `app_user`-Spalten bleiben gültig. Vorher den Eintrag 18 aus `_sqlx_migrations` entfernen (sqlx würde sonst mit `VersionMissing(18)` abbrechen).
