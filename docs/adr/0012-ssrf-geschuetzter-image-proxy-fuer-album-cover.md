# ADR-0012: Image-Proxy mit Server-Side Request Forgery (SSRF) Schutz für Album-Cover

* **Status:** Accepted
* **Datum:** 2026-10-15
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#85](https://github.com/gerontosepp/vinyl-tracker/issues/85), Release v0.8.0

---

## Kontext & Problemstellung

Die Cover-Bilder von Schallplatten stammen aus der Discogs-API und liegen auf externen CDNs (z. B. `i.discogs.com`). Beim direkten Laden dieser Bilder durch den Browser des Nutzers treten gravierende Probleme auf:
1. **CORS & Hotlinking-Schutz:** Discogs blockiert direkte Bildabrufe teilweise durch strikte Referrer- oder User-Agent-Prüfungen.
2. **Mixed-Content:** Auf HTTPS-Deployments führen unverschlüsselte Bild-Links zu Browser-Warnungen.
3. **Privatsphäre:** Beim direkten Abruf durch den Client wird die IP-Adresse des Nutzers an Drittanbieter-CDNs exponiert.

Ein naiver serverseitiger Bild-Proxy (der jede übergebene URL lädt und durchreicht) öffnet jedoch eine fatale Sicherheitslücke: **Server-Side Request Forgery (SSRF)**. Ein Angreifer könnte den Server veranlassen, interne Dienste im LAN oder auf `localhost` aufzurufen (z. B. `http://127.0.0.1:5432` für PostgreSQL, Cloud-Metadaten-Services wie `http://169.254.169.254`, oder interne Proxmox/FritzBox-Webinterfaces).

## Entscheidungstreiber

* **Sicherheit:** Zuverlässige Abwehr von SSRF-Angriffen, DNS-Rebinding und dem Scannen interner Netzwerke.
* **Zuverlässige Cover-Anzeige:** Vermeidung von gebrochenen Bildern durch Hotlinking-Blockaden.
* **Performance:** Schnelles Ausliefern gecachter Bilder via In-Memory-Cache (`moka`).
* **Privatsphäre:** Vollständige Kapselung der externen Bildabrufe über den Server.

## Betrachtete Optionen

* **Option 1: Dedizierter Image-Proxy mit Domain-Allowlist, IP-Validierung und Moka-Cache (Gewählt)**
  * *Vorteile:* Strikte Validierung vor dem HTTP-Request: DNS-Auflösung und Prüfung der Ziel-IP (Ausschluss von Loopback `127.0.0.0/8`, RFC-1918-Privatnetzen `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, Link-Local `169.254.0.0/16` und Multicast); konfigurierbare Host-Allowlist (`IMAGE_PROXY_ALLOWED_HOSTS`); In-Memory-Caching via `moka` zur Schonung von Bandbreite und Discogs-Limits.
  * *Nachteile:* Eigener Service-Code im Backend (`ImageProxyService`).

* **Option 2: Ungeprüfter Proxy (Pass-Through)**
  * *Vorteile:* Sehr wenig Code.
  * *Nachteile:* Kritisches Sicherheitsrisiko (SSRF). Ermöglicht unberechtigten Zugriff auf das interne Heimnetzwerk des Betreibers.

* **Option 3: Direkte Einbindung externer Bild-URLs im Frontend**
  * *Vorteile:* Kein Server-Traffic für Bilder.
  * *Nachteile:* Häufige Ladefehler durch CORS/Hotlink-Schutz; exponiert Client-IPs; funktioniert nicht im serverseitigen PDF-Generator.

## Entscheidung

Vinyl Tracker implementiert einen **gehärteten Image-Proxy** (`/api/proxy/image?url=...`):

1. **URL- und Protokollprüfung:** Nur strikte `https://`-URLs sind zugelassen.
2. **Domain-Allowlist:** Es werden standardmäßig nur vertrauenswürdige Bild-CDNs akzeptiert (u. a. `*.discogs.com`, `i.discogs.com`, erweiterbar via `IMAGE_PROXY_ALLOWED_HOSTS`).
3. **SSRF-IP-Blockierung:** Vor dem Request wird die IP-Adresse aufgelöst. Folgende Bereiche werden strikt abgewiesen:
   * Loopback (`127.0.0.0/8`, `::1`)
   * Private Netze (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, Unique Local `fc00::/7`)
   * Link-Local (`169.254.0.0/16`, `fe80::/10`)
   * Broadcast & Multicast (`224.0.0.0/4`, `ff00::/8`)
4. **Caching:** Erfolgreich geladene Bilder werden in einem Moka-In-Memory-Cache vorgehalten, um wiederholte externe Abrufe zu vermeiden.
5. **Authentifizierter Upstream-Header:** Der Proxy setzt bei Abrufen an Discogs automatisch den konfigurierten `User-Agent` und optionale Auth-Header.

## Konsequenzen

### Positive Effekte
* **Vollständige SSRF-Sicherheit:** Interne Dienste und IP-Bereiche können über den Proxy unter keinen Umständen attackiert werden.
* **100 % Cover-Verfügbarkeit:** Keine gebrochenen Bilder mehr durch Hotlinking-Blocker.
* **Geringe Latenz:** Gecachte Cover werden direkt aus dem Arbeitsspeicher in wenigen Millisekunden ausgeliefert.

### Nachteile & Risiken
* **Speicherbedarf:** Der Moka-Cache verbraucht bei tausenden Bildern etwas RAM (wird durch konfigurierbare Max-Size begrenzt).
