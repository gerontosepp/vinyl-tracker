# ADR-0024: `ring` als TLS-Provider für `reqwest` 0.13

* **Status:** Accepted
* **Datum:** 2026-11-05
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#328](https://github.com/gerontosepp/vinyl-tracker/issues/328)

---

## Kontext & Problemstellung

`reqwest` 0.13 hat die TLS-Features umgebaut: `rustls-tls` (gebündelte Mozilla-Roots, Provider `ring`) entfällt. Das Feature `rustls` bringt `aws-lc-rs` mit, einen C-Build (`aws-lc-sys`), den die Multi-Arch-Docker-Builds (Cross-Kompilierung nach arm64) nicht abgesichert abdecken. Zertifikate prüft `reqwest` 0.13 über `rustls-platform-verifier`, also über den System-Zertifikatsspeicher statt über gebündelte Roots.

## Betrachtete Optionen

* **Option 1: Feature `rustls`** – kein eigener Code, aber `aws-lc-rs` mit C-Toolchain in allen Builds.
* **Option 2: Feature `rustls-no-provider` + `ring`** – bleibt bei `ring` (bereits im Baum über `sqlx`/`rustls`), erfordert aber einen explizit installierten Provider.

## Entscheidung

Option 2. `backend/src/tls.rs` installiert `ring` einmalig als Prozess-Provider; alle ausgehenden HTTP-Clients entstehen über `tls::http_client_builder()`, damit die Vorbedingung nicht an den Aufrufstellen vergessen werden kann. Ohne Provider paniert `reqwest` 0.13 beim Bauen des Clients.

## Konsequenzen

### Positive Effekte
* Kein C-Build für TLS, Multi-Arch-Images bleiben unverändert.
* Der System-Zertifikatsspeicher berücksichtigt auch eigene CAs (z. B. TLS-inspizierende Proxys).

### Nachteile & Risiken
* **`ca-certificates` ist jetzt eine harte Laufzeit-Voraussetzung.** Das Runtime-Image installiert das Paket; eigene Images oder LXC-Installationen (Proxmox) brauchen es ebenfalls, sonst scheitern HTTPS-Aufrufe zu Discogs, OpenRouter und dem Bild-Proxy.
* Wer ein ausgehendes `reqwest::Client::builder()` direkt verwendet, umgeht den Helfer und riskiert die Panic; neue Clients immer über `tls::http_client_builder()` bauen.
* Ein späterer Wechsel auf das Standard-Feature `rustls` (`aws-lc-rs`) muss die Multi-Arch-Builds prüfen.
