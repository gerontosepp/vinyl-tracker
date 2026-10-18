# ADR-0004: Kryptografie-Modernisierung auf authentifiziertes AES-256-GCM (AEAD) für Discogs-Tokens

* **Status:** Accepted
* **Datum:** 2026-10-17
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#101](https://github.com/gerontosepp/vinyl-tracker/issues/101), Pull Request [#104](https://github.com/gerontosepp/vinyl-tracker/pull/104)

---

## Kontext & Problemstellung

Benutzer können in Vinyl Tracker ihren persönlichen Discogs-API-Token hinterlegen, um Alben zu synchronisieren und Marktdaten abzurufen. Diese Tokens werden verschlüsselt in der PostgreSQL-Datenbank abgelegt.

Die ursprüngliche Implementierung des `CryptoService` wies gravierende kryptografische Schwachstellen auf:
* Verwendung von AES im unauthentifizierten **CBC-Modus** (Cipher Block Chaining).
* Fehlender Integritäts- und Authentizitätsschutz (kein MAC / HMAC), wodurch die Chiffretext-Daten anfällig für Padding-Oracle- und Bit-Flipping-Angriffe waren.
* Schlüsselableitung mittels veraltetem SHA-1 PBKDF2 mit unzureichender Iterationsanzahl.

Es war eine zeitgemäße, nach BSI-/OWASP-Kriterien sichere Verschlüsselung einzuführen, ohne bestehende Tokens in der Datenbank ungültig zu machen.

## Entscheidungstreiber

* **Authentifizierte Verschlüsselung (AEAD):** Schutz sowohl der Vertraulichkeit als auch der Integrität und Authentizität der Chiffretexte.
* **Stand der Technik:** Konformität mit BSI TR-02102 und OWASP Cryptographic Storage Cheat Sheet (mindestens 100.000 PBKDF2-Iterationen).
* **Transparente Migration:** Bestehende Tokens müssen im laufenden Betrieb weiter entschlüsselt und bei nächster Speicherung automatisch auf das moderne Format migriert werden (Zero Downtime).

## Betrachtete Optionen

* **Option 1: AES-256-GCM (AEAD) mit PBKDF2-HMAC-SHA256 (100.000 Iterationen) (Gewählt)**
  * *Vorteile:* Industriestandard für AEAD; Hardware-Beschleunigung via AES-NI auf x86_64 und Apple Silicon; 96-Bit-Zufallsnonce und 128-Bit-Authentifizierungstag verhindern jegliche Manipulation; direkte Unterstützung in Rust via `aes-gcm`.
  * *Nachteile:* Erfordert Versions-Präfix zur Unterscheidung von Altdaten.

* **Option 2: ChaCha20-Poly1305**
  * *Vorteile:* Hervorragende Performance auf Systemen ohne dedizierte AES-Hardware.
  * *Nachteile:* Auf Standard-Server-CPUs und modernen ARM-Kernen ist hardwarebeschleunigtes AES-GCM mindestens gleichwertig oder schneller; geringere formale BSI-Verbreitung im Enterprise-Kontext.

* **Option 3: Manuelle Komposition AES-CBC + HMAC-SHA256 (Encrypt-then-MAC)**
  * *Vorteile:* Weiterverwendung von CBC.
  * *Nachteile:* Fehleranfällige manuelle Komposition ("Cryptographic Doom Principle"); deutlich komplexer als ein standardisiertes primitives AEAD-Verfahren wie GCM.

## Entscheidung

Der `CryptoService` wird vollständig auf **AES-256-GCM** umgestellt:
1. **Schlüsselableitung:** PBKDF2 mit **HMAC-SHA256** und **100.000 Iterationen** unter Verwendung des konfigurierten `VINYL_ENCRYPTION_PASSWORD` und `VINYL_ENCRYPTION_SALT`.
2. **Chiffretext-Format:** Neu verschlüsselte Tokens erhalten das Versionspräfix `v2:`, gefolgt von Base64-kodierter 96-Bit-Nonce, Chiffretext und 128-Bit-GCM-Tag:
   ```
   v2:<base64(nonce || ciphertext || auth_tag)>
   ```
3. **Abwärtskompatibilität:** Der Service erkennt Chiffretexte ohne `v2:`-Präfix und entschlüsselt sie mit der Legacy-CBC-Logik. Bei der nächsten Aktualisierung des Tokens wird dieser automatisch im modernen `v2:`-Format persistiert.

## Konsequenzen

### Positive Effekte
* **Kryptografische Härtung:** Bit-Flipping und Tampering führen sofort zu einem kontrollierten Entschlüsselungsfehler (`AppError::InternalServerError`).
* **Zukunftssicher:** BSI- und OWASP-konforme Schlüsselableitung und Chiffrierung.
* **Nahtlose Benutzererfahrung:** Kein Benutzer muss sein Discogs-Token nach dem Update neu eingeben.

### Nachteile & Risiken
* **Leicht erhöhter Rechenaufwand:** 100.000 Iterationen beanspruchen minimal mehr CPU bei der Schlüsselableitung (im Rahmen von < 5 ms pro Token-Operation).
