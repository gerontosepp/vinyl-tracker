# ADR-0006: Automatisierte Rust-Testabdeckungsprüfung in der CI-Pipeline via `cargo-llvm-cov` (>= 80%)

* **Status:** Accepted
* **Datum:** 2026-10-18
* **Beteiligte:** Entwicklungsteam / Core Maintainer
* **Kontextbezug:** GitHub Issue [#111](https://github.com/gerontosepp/vinyl-tracker/issues/111)

---

## Kontext & Problemstellung

Im Frontend von Vinyl Tracker ist bereits eine strikte Mindest-Testabdeckung von > 80 % in der CI-Pipeline (`.github/workflows/ci.yml`) über Karma und Istanbul verankert. Fällt die Abdeckung unter diese Schwelle, schlägt der CI-Build fehl.

Für das Rust-Backend existierte bisher keine automatisierte Coverage-Messung und -Prüfung. Neue Features und Refactorings konnten theoretisch ohne ausreichende Testabdeckung gemergt werden.

Eine initiale Bestandsaufnahme des Backends ergab eine Zeilenabdeckung von ca. **66.6 %** (6.617 von 9.142 Zeilen). Für Ticket [#111](https://github.com/gerontosepp/vinyl-tracker/issues/111) war zu entscheiden:
1. Welches Tooling zur Messung der Rust-Code-Coverage eingesetzt wird.
2. Wie die 80 %-Schranke in der CI-Pipeline verankert wird.

## Entscheidungstreiber

* **Determinismus & Zuverlässigkeit:** Exakte, reproduzierbare Coverage-Zahlen ohne Heuristiken oder Flakiness.
* **Plattformunabhängigkeit:** Das Tool muss sowohl auf Linux (x86_64, aarch64 CI-Runner) als auch lokal auf Entwickler-Maschinen (macOS Apple Silicon) identisch funktionieren.
* **Performance:** Schnelle Ausführung ohne exzessive Kompilier- oder Instrumentierungs-Overheads in der CI-Pipeline.
* **Fail-Under-Support:** Direkte Unterstützung einer harten Abbruch-Bedingung bei Unterschreitung eines Prozentwerts (CLI-Flag oder Exit-Code).

## Betrachtete Optionen

* **Option 1: `cargo-llvm-cov` (Gewählt)**
  * *Vorteile:* Nutzt die in `rustc` eingebaute LLVM Source-Based Code Coverage (`-C instrument-coverage`); offiziell von der Rust-Community und LLVM empfohlen; plattformübergreifend (Linux, macOS, Windows); extrem schnell; direkte Unterstützung von `--fail-under-lines 80`; erzeugt Text-Tabellen, LCOV, JSON und HTML-Reports; einfache CI-Installation via `taiki-e/install-action@cargo-llvm-cov`.
  * *Nachteile:* Benötigt das `llvm-tools-preview`-Komponentenpaket von `rustup` (wird von `cargo-llvm-cov` automatisch installiert).

* **Option 2: `cargo-tarpaulin`**
  * *Vorteile:* Weit verbreitet für reine Linux x86_64 Umgebungen.
  * *Nachteile:* Basiert auf `ptrace` und System-Calls; funktioniert nicht nativ auf macOS; scheitert häufig in Docker-Container-Umgebungen mit strikten `seccomp`- oder ASLR-Restriktionen; langsamere Ausführung bei großen Test-Suiten.

* **Option 3: `grcov`**
  * *Vorteile:* Mächtiges Tool von Mozilla zur Aggregation von Profraw-Dateien.
  * *Nachteile:* Deutlich aufwendigere manuelle Konfiguration (Kompilierung mit Profiling-Flags, manuelles Auffinden und Mergen von `.profraw`-Dateien, manuelles Berechnen von Schwellenwerten).

## Entscheidung

Für die Rust-Testabdeckungsprüfung in Vinyl Tracker wird **`cargo-llvm-cov`** ausgewählt:
1. **CI-Integration:**
   * Der CI-Job `backend-test` in `.github/workflows/ci.yml` wird um `taiki-e/install-action@cargo-llvm-cov` ergänzt.
   * Die Ausführung erfolgt mit PostgreSQL-Test-Container über:
     ```bash
     cargo llvm-cov --fail-under-lines 80 --verbose
     ```
2. **Abdeckungssteigerung:**
   * Die Test-Suiten in `backend/tests/` und Modul-Unit-Tests werden systematisch ausgebaut (speziell `collection_sync`, `scan_service`, `marketplace`, `record_service`, `discogs`), um den Ist-Stand von 66.6 % über die geforderte 80 %-Marke zu heben.
3. **Qualitätsrichtlinie:**
   * In `.agent/rules/quality_standards.md` wird festgelegt, dass sowohl im Frontend als auch im Backend eine Mindestabdeckung von 80 % eingehalten werden muss.

## Konsequenzen

### Positive Effekte
* **Konsistente Qualitätsstandards:** Frontend und Backend erzwingen gleichermaßen eine harte 80 %-Qualitätsschranke.
* **Hohe Sicherheit gegen Regressionen:** Nicht getesteter Code kann weder in `develop` noch in `main` gemergt werden.
* **Lokale Entwickler-Parität:** Entwickler können jederzeit lokal `cargo llvm-cov` ausführen und sehen exakt dieselben Metriken wie in CI.

### Nachteile & Risiken
* **Initialer Aufwand:** Bestehende Lücken in komplexeren Modulen (z. B. Netzwerk-Mocks für externe APIs) müssen vor Aktivierung des harten Pipeline-Fehlers durch Tests geschlossen werden.
