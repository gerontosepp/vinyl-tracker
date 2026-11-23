# ADR-0026: Anbieterunabhängige KI-Verbindungen

* **Status:** Accepted
* **Datum:** 2026-11-13
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#393](https://github.com/gerontosepp/vinyl-tracker/issues/393), OpenSpec-Change `393-flexible-ai-providers`; löst die Anbieterbindung aus [ADR-0022](0022-label-erkennung-in-der-app-ueber-openrouter.md)

---

## Kontext & Problemstellung

Die automatische Label-Erkennung (ADR-0022) sprach ausschließlich OpenRouter an. Key und Modell lagen in dedizierten `app_user`-Spalten, der Client war auf OpenRouter-URL, Bearer-Auth und OpenRouter-Fehlertexte festgelegt. Eigene OpenAI-, Anthropic- oder Google-Keys, lokale Modelle (Ollama, LM Studio) und Gateways (LiteLLM) waren nicht nutzbar; jeder neue Anbieter hätte Code-Änderungen erfordert.

## Entscheidungstreiber

* **Flexibilität:** Neue Anbieter sollen ohne Rust-Änderung konfigurierbar sein.
* **Datenschutz/Kosten:** Nutzer sollen lokale Modelle oder eigene Anbieter wählen können.
* **Kompatibilität:** Bestehende OpenRouter-Keys und -Modelle müssen verlustfrei weiterlaufen.
* **Sicherheit:** Nutzerdefinierte URLs dürfen keine SSRF-Lücke öffnen; Keys bleiben verschlüsselt und write-only.
* **Wartbarkeit:** Ein Adapter statt eines Adapters pro Anbieter.

## Betrachtete Optionen

* **Option 1: Native Adapter pro Anbieter** – maximale Feature-Abdeckung, aber drei Tool-Calling-Schemata, drei Bildformate und dauerhaft N Adapter.
* **Option 2: LiteLLM als vorgeschaltetes Gateway** – ein zusätzlicher Dienst, den jeder Nutzer betreiben müsste.
* **Option 3: Ein OpenAI-kompatibler Client mit Presets (gewählt)** – alle relevanten Anbieter bieten heute einen OpenAI-kompatiblen Chat-Completions-Endpunkt mit Bild-Input und Tool-Calling; neue Anbieter brauchen nur einen Preset-Eintrag.

## Entscheidung

Option 3:

1. **Datenmodell `ai_connection`:** Pro Nutzer mehrere benannte Verbindungen mit Preset, Base-URL, Modell, verschlüsseltem Key, Auth-Art und `extra_headers`. Ein partieller Unique-Index erzwingt genau eine Standard-Verbindung pro Nutzer.
2. **Preset-Registry im Backend:** OpenRouter, OpenAI, Anthropic, Google Gemini, Groq, Mistral, DeepSeek, Together, Fireworks, Ollama, LM Studio, Azure OpenAI und Custom. Presets liefern Standard-URL und Auth-Art; die Modell-ID bleibt frei.
3. **Ein generischer Client:** `clients/ai.rs` baut `<base>/chat/completions` (Azure inklusive Deployment-Pfad und `api-key`-Header), mappt 401/403/404/429/Timeout auf anbieterneutrale `ProblemDetail`-Fehler und unterstützt `/models` best effort.
4. **Label-Erkennung:** nutzt die Standard-Verbindung, speichert zusätzlich `label_photo.identify_provider` und zeigt „Anbieter · Modell“. Ohne nutzbare Standard-Verbindung bleibt der bisherige MCP-Weg unverändert.
5. **Kompatibilität:** Migration 18 übernimmt vorhandene OpenRouter-Werte in eine Standard-Verbindung; die alten Spalten bleiben ein Release lang erhalten. `GET`/`PUT /api/users/me/openrouter` bleiben als Alias bestehen.
6. **Sicherheit:** Base-URLs werden vor dem Speichern und vor Requests validiert (nur HTTP/HTTPS, keine Userinfo, Metadata-/Link-Local-Block, HTTPS für öffentliche Hosts, HTTP nur lokal/privat, optionale `AI_BASE_URL_ALLOWED_HOSTS`). Keys werden mit AES-256-GCM verschlüsselt, nie ausgeliefert und nie geloggt.

## Konsequenzen

### Positive Effekte
* Anbieterwechsel und neue Anbieter ohne Code-Änderung; ein Adapter statt N nativer Adapter.
* Lokale Modelle und eigene Keys sind gleichberechtigt; Kosten und Datenschutz bleiben beim Nutzer.
* Bestehende OpenRouter-Nutzer merken vom Upgrade nichts.
* Die Sicherheitsregeln gelten zentral für alle Anbieter.

### Nachteile & Risiken
* **Capability-Unterschiede:** Der Client prüft nicht automatisch, ob ein Modell Bild-Input und Tool-Calling beherrscht; die UI weist darauf hin.
* **Anbieter-Drift:** OpenAI-kompatible Endpunkte können im Detail abweichen; der Test-Endpunkt macht Fehler sichtbar.
* **SSRF-Restrisiko:** DNS-Rebinding lässt sich ohne vollständige IP-Pinning-Lösung nicht ausschließen; die optionale Host-Allowlist begrenzt das Risiko.
* **Native Protokolle:** Features, die nur die nativen Anthropic-/Gemini-APIs bieten, sind nicht verfügbar; bei Bedarf kann später ein zweiter Adapter ergänzt werden.
* **Lokale Modelle:** Erster Request und Bildanalyse können langsam sein; das 90-Sekunden-Timeout und der Test-Endpunkt machen das transparent.
* **Rollback:** Das vorherige Image kennt Migration 18 nicht; `sqlx` verweigert den Start mit `VersionMissing(18)`. Vor einem Rollback muss der Eintrag 18 aus `_sqlx_migrations` entfernt oder der Migrator mit `ignore_missing` betrieben werden. Die alten `app_user`-Spalten bleiben dafür erhalten.
