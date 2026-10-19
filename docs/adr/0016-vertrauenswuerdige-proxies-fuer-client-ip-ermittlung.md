# ADR-0016: Vertrauenswürdige Proxies für die Client-IP-Ermittlung (Auth-Rate-Limiting)

* **Status:** Accepted
* **Datum:** 2026-10-19
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#121](https://github.com/gerontosepp/vinyl-tracker/issues/121), Security-Review v0.9.0

---

## Kontext & Problemstellung

Die öffentlichen Auth-Endpunkte (`/api/users/login`, `/register`, `/reset-password`) sind per IP-basiertem Rate-Limit (`governor`, `AUTH_RATE_LIMIT_FOR_PERIOD`) gegen Brute-Force geschützt. Die bisherige Ermittlung der Client-IP hatte zwei Schwächen:

1. **Spoofing:** Der erste Eintrag aus `X-Forwarded-For` bzw. `X-Real-IP` wurde ungeprüft übernommen. Jeder Client konnte durch rotierende Header-Werte das Limit beliebig umgehen – auch hinter nginx, da `$proxy_add_x_forwarded_for` vom Client gesendete Werte links beibehält.
2. **Gemeinsamer Bucket:** Der Server wurde ohne `ConnectInfo` gestartet. Ohne Forwarding-Header fielen alle Clients auf `127.0.0.1` zurück und teilten sich ein Kontingent – ein einzelner Client konnte so den Login für alle sperren.

Zusätzlich war das Backend in den Produktions-Compose-Dateien auf `0.0.0.0:8080` veröffentlicht und damit unter Umgehung von nginx direkt erreichbar.

## Entscheidungstreiber

* **Sicherheit:** Rate-Limit darf durch Client-gesteuerte Header nicht umgehbar sein.
* **Korrektheit hinter Reverse-Proxies:** Hinter nginx (Docker-Netzwerk) muss die echte Client-IP erkannt werden.
* **Einfacher Betrieb:** Sinnvolle Defaults für das mitgelieferte Docker-Setup.

## Betrachtete Optionen

* **Option 1: Allowlist vertrauenswürdiger Proxies (`TRUSTED_PROXIES`) mit Rechts-nach-links-Auswertung von `X-Forwarded-For` (Gewählt)**
  * *Vorteile:* Branchenüblicher Ansatz (vgl. nginx `real_ip`, Spring `ForwardedHeaderFilter`); funktioniert mit Proxy-Ketten; ohne Konfiguration sicher (Header werden ignoriert).
  * *Nachteile:* Betreiber müssen bei abweichenden Netzen `TRUSTED_PROXIES` anpassen.

* **Option 2: Forwarding-Header grundsätzlich ignorieren, nur TCP-Peer verwenden**
  * *Vorteile:* Maximal einfach und nicht fälschbar.
  * *Nachteile:* Hinter nginx teilen sich alle Nutzer die IP des Proxys – gleiches Problem wie der gemeinsame Bucket.

* **Option 3: Externe Crate (z. B. `axum-client-ip`)**
  * *Vorteile:* Fertige Lösung.
  * *Nachteile:* Zusätzliche Abhängigkeit für ~40 Zeilen Logik; Konfiguration über Enum-Varianten statt CIDR-Allowlist.

## Entscheidung

Die Client-IP wird in `backend/src/auth/client_ip.rs` (`resolve_client_ip`) wie folgt ermittelt:

1. Der Server läuft mit `into_make_service_with_connect_info::<SocketAddr>()`, der direkte TCP-Peer ist damit stets bekannt.
2. Ist der Peer **nicht** in `TRUSTED_PROXIES` (CIDR-Liste, z. B. `172.16.0.0/12,10.0.0.5`), wird seine Adresse verwendet; Forwarding-Header werden ignoriert.
3. Ist der Peer vertrauenswürdig, wird `X-Forwarded-For` **von rechts nach links** durchlaufen und der erste nicht vertrauenswürdige Hop verwendet. Fallback: `X-Real-IP`, danach der Peer selbst.
4. Default für `TRUSTED_PROXIES` ist leer (Header werden ignoriert). Die Produktions-Compose-Dateien setzen `172.16.0.0/12,192.168.0.0/16` (Docker-Bridge-Netze, in denen nginx läuft).
5. In `docker-compose.prod.yml` und `docker-compose.registry.yml` sind Backend (`8080`) und PostgreSQL (`5432`) nur noch auf `127.0.0.1` veröffentlicht. Externer Zugriff erfolgt ausschließlich über nginx; lokale Werkzeuge wie der MCP-Server behalten Zugriff.

## Konsequenzen

### Positive Effekte
* Rate-Limit ist nicht mehr per Header-Spoofing umgehbar; Clients ohne Proxy erhalten eigene Kontingente.
* Backend und Datenbank sind in Produktion nicht mehr direkt aus dem Netzwerk erreichbar.

### Nachteile & Risiken
* Wird ein zusätzlicher Reverse-Proxy (z. B. TLS-Terminierung auf einem anderen Host) vorgeschaltet, muss dessen Adresse in `TRUSTED_PROXIES` ergänzt werden – sonst teilen sich alle Clients dessen IP.
* Externe Clients, die bisher direkt `http://<host>:8080` nutzten (z. B. MCP-Server auf einem anderen Rechner), müssen auf die nginx-URL (`http://<host>/api`) umgestellt werden.
