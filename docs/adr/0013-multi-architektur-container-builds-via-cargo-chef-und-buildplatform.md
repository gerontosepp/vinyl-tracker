# ADR-0013: Multi-Architektur Container-Builds via Native Compilation (`$BUILDPLATFORM`) & `cargo-chef`

* **Status:** Accepted
* **Datum:** 2026-10-15
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issues [#72](https://github.com/gerontosepp/vinyl-tracker/issues/72), [#82](https://github.com/gerontosepp/vinyl-tracker/issues/82), Release v0.7.0 / v0.8.0

---

## Kontext & Problemstellung

Vinyl Tracker wird auf unterschiedlichen Hardware-Architekturen betrieben:
* **`linux/amd64`:** Standard x86_64-Server, Cloud-VMs, PCs.
* **`linux/arm64`:** Raspberry Pi 4/5, Apple Silicon Mac Mini Home-Server, ARM-basierte Proxmox-Knoten.

Das Erzeugen von Multi-Architektur-Docker-Images (`linux/amd64`, `linux/arm64`) in GitHub Actions und auf lokalen Proxmox CI-Runnern brachte massive Hürden mit sich:
1. **Extreme Build-Zeiten durch QEMU-Emulation:** Das Kompilieren von TypeScript/Angular und das Bauen von Rust-Crates unter softwareemuliertem ARM64 auf x86_64-Hardware dauerte über 30–45 Minuten oder brach durch CI-Timeouts ab.
2. **Fehlendes Layer-Caching bei Rust-Builds:** Bei jeder winzigen Code-Änderung wurden alle 200+ Rust-Dependencies von Grund auf neu kompiliert.
3. **Inkonsistente Lockfiles:** Standardmäßiges `npm install` im Frontend-Container führte zu nicht-deterministischen Paketbäumen.

## Entscheidungstreiber

* **Schnelle CI/CD-Pipelines:** Multi-Architektur-Builds müssen innerhalb weniger Minuten abgeschlossen sein (< 5 Minuten).
* **Deterministische Builds:** Identische Artefakt-Erzeugung auf jeder Plattform.
* **Effizientes Docker-Layer-Caching:** Dependencies sollen nur neu gebaut werden, wenn sich `Cargo.lock` oder `package-lock.json` tatsächlich geändert haben.

## Betrachtete Optionen

* **Option 1: Native Host-Kompilierung (`--platform=$BUILDPLATFORM`) für Frontend und `cargo-chef` für Backend (Gewählt)**
  * *Vorteile:* 
    * *Frontend:* Node/Angular kompiliert nativ auf der Host-Architektur des Runners (`$BUILDPLATFORM`) ohne jegliche QEMU-Emulation; erst das finale Nginx-Laufzeit-Image wird für die Zielarchitektur gepackt.
    * *Backend:* `cargo-chef` zerlegt den Rust-Build in Vorbereitungs- (`chef prepare`) und Koch-Stufen (`chef cook --release`), sodass compilierte Dependencies als Docker-Layer gecacht bleiben, solange `Cargo.lock` unverändert ist.
    * *Deterministik:* `npm ci --legacy-peer-deps` garantiert exakte Lockfile-Einhaltung.
  * *Nachteile:* Erfordert Docker Buildx und etwas komplexere Dockerfiles.

* **Option 2: Vollständige Emulation aller Stages via QEMU**
  * *Vorteile:* Einfache Standard-Dockerfiles.
  * *Nachteile:* Inakzeptabel langsam (Faktor 10x bis 20x langsamer); ständige Timeouts in GitHub Actions.

* **Option 3: Getrennte physische Runner für jede Architektur**
  * *Vorteile:* Kein Emulations-Overhead.
  * *Nachteile:* Erfordert teure physische Hardware für beide Plattformen; hoher Wartungsaufwand für Runner-Infrastruktur.

## Entscheidung

Die Docker-Build-Architektur wird für Frontend und Backend optimiert:

1. **Frontend ([`frontend/Dockerfile`](file:///Users/opolm/develop/AntiGrafity/frontend/Dockerfile)):**
   ```dockerfile
   # Nativ auf der Host-CPU kompilieren (kein QEMU!)
   FROM --platform=$BUILDPLATFORM node:24-alpine AS build
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --legacy-peer-deps
   COPY . .
   RUN npm run build

   # Erst das leichtgewichtige Nginx-Image nutzt die Ziel-Architektur
   FROM nginx:alpine AS production
   COPY --from=build /app/dist/frontend /usr/share/nginx/html
   ```
2. **Backend ([`backend/Dockerfile`](file:///Users/opolm/develop/AntiGrafity/backend/Dockerfile)):**
   * Multi-Stage-Build mit **`cargo-chef`**:
     * `planner`-Stage: Extrahiert die reine Abhängigkeitsstruktur aus `Cargo.toml`/`Cargo.lock` in eine `recipe.json`.
     * `builder`-Stage: Führt `cargo chef cook --release --recipe-path recipe.json` aus. Dieser Layer wird von Docker gecacht, solange sich keine Crates ändern.
     * `runtime`-Stage: Minimales Alpine-/Scratch-Container-Image (< 35 MB).
3. **CI/CD-Workflow ([`.github/workflows/ci.yml`](file:///Users/opolm/develop/AntiGrafity/.github/workflows/ci.yml)):**
   * Nutzung von `docker/build-push-action@v6` mit GHA-Cache-Provider (`type=gha`).
   * Explizite Deaktivierung von OCI-Provenance-Attestations (`provenance: false`), um Manifest-Konflikte bei GHCR zu vermeiden.

## Konsequenzen

### Positive Effekte
* **Drastische Beschleunigung:** Die Build-Zeit für Multi-Arch-Images sank von über 30 Minuten auf ca. 3–5 Minuten.
* **Massive Bandbreiteneinsparung:** Durch `cargo-chef` müssen bei Code-Commits nur noch wenige eigene Quelldateien neu gebaut werden.
* **Kleinste Images:** Backend < 40 MB, Frontend < 25 MB auf allen Ziel-Architekturen.

### Nachteile & Risiken
* **Buildx-Abhängigkeit:** Lokale Builds erfordern Docker mit Buildx-Unterstützung (auf allen modernen Systemen standardmäßig vorhanden).
