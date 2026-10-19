# Tasks

## 1. DTO & Model-Erweiterung (`mcp/src/models.rs`)

- [ ] 1.1 `ExportCollectionArgs` (mit `format: String`) und Prompt-Argumente (`RecommendRecordPromptArgs`, `GradingAuditPromptArgs`) definieren
- [ ] 1.2 DTOs für `ResourceSummary` / Resource-Datenstrukturen hinzufügen

## 2. API-Client Erweiterung (`mcp/src/client.rs`)

- [ ] 2.1 Methode `export_collection(&self, format: &str) -> Result<String, String>` implementieren
- [ ] 2.2 Relevante Client-Methoden für Sammlungs- und Statistikdaten bereitstellen

## 3. Tool-, Prompt- & Resource-Implementierung (`mcp/src/server.rs`)

- [ ] 3.1 Tool `export_collection` im `#[tool_router]` registrieren
- [ ] 3.2 Prompts `recommend_record` und `grading_audit` via `#[prompt]` und `#[prompt_router]` implementieren
- [ ] 3.3 Resources `vinyl://collection/summary`, `vinyl://collection/value` und `vinyl://stats/overview` via `list_resources` und `read_resource` implementieren
- [ ] 3.4 `ServerCapabilities` und `get_info()` auf `ServerHandler` konfigurieren

## 4. Tests & Validierung

- [ ] 4.1 Unit-Tests in `mcp/src/server.rs` für Registrierung von Tools, Prompts und Resources erweitern
- [ ] 4.2 Formatting (`cargo fmt --manifest-path mcp/Cargo.toml`) und Linter (`cargo clippy --manifest-path mcp/Cargo.toml --all-targets -- -D warnings`) prüfen
- [ ] 4.3 Alle Tests ausführen (`cargo test --manifest-path mcp/Cargo.toml`)

## 5. Dokumentation & OpenSpec-Abschluss

- [ ] 5.1 `mcp/README.md` mit den neuen Tools, Resources und Prompts aktualisieren
- [ ] 5.2 `docs/Release-Info.md` aktualisieren und synchronisieren
- [ ] 5.3 OpenSpec Change validieren und archivieren
