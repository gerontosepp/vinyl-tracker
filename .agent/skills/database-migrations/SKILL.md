---
name: database-migrations
description: >-
  Guide and best practices for creating and applying sqlx database migrations,
  updating SQLx models, and maintaining PostgreSQL schema consistency in Vinyl Tracker.
---

# Vinyl Tracker Database Migrations Skill

This skill defines the process for evolving the PostgreSQL schema using `sqlx::migrate` alongside SQLx models (see [ADR-0017](../../../docs/adr/0017-datenbank-migrationen-mit-sqlx-migrate.md)).

## 1. Migration File Conventions

Migration scripts are stored in:
`backend/migrations/`

Naming convention (sqlx):
`<VERSION>_<DESCRIPTION>.sql` (version number, **single** underscore, no `V` prefix)

*Example*: `10_add_new_feature.sql` (the next free version after `9_add_median_price_to_record_cache.sql`)

> A `V`-prefixed Flyway-style name (`V10__…`) cannot be parsed by `sqlx::migrate!` and breaks the backend build.

### Best Practices for Migration Scripts
- **PostgreSQL Compatibility**: Use valid PostgreSQL syntax.
- **Idempotency & Safety**: Use `IF NOT EXISTS` where applicable for indexes and tables.
- **Explicit Constraints**: Always provide explicit names for foreign keys and indexes (e.g. `idx_<table_name>_<column_name>`).
- **UTC Timestamps**: Use `TIMESTAMP WITHOUT TIME ZONE` or `TIMESTAMPTZ` consistent with the existing schema and store timestamps in UTC.
- **Never Modify Shipped Migrations**: Once committed, migration scripts (`1_…` to `9_…`) must never be edited – not even comments. sqlx stores a SHA-384 checksum of each applied file and refuses to start on a mismatch. Create a new incremental script instead.

## 2. SQLx Models & Schema Synchronization

When changing the schema:
1. **Migration First**: Write the SQL migration script in `backend/migrations/`. `backend/build.rs` makes sure the embedded migrations are recompiled.
2. **Update SQLx Models**: Modify or create domain models under `backend/src/models/`. REST request/response DTOs shared with the MCP server live in `backend/crates/vinyl-api-types/` (re-exported from `backend/src/models/`).
   - Follow strict UTC rules: Use `chrono::DateTime<Utc>` or `chrono::NaiveDateTime` for all date/time fields.
3. **Update Queries / Services**: Adjust SQLx queries in `backend/src/services/` or `backend/src/routes/`.

## 3. Migration Execution

- **Automatic Startup Migration**: `backend/src/db/migrations.rs` (`run_migrations(&PgPool)`) applies pending migrations on server startup under a PostgreSQL advisory lock. History table: `_sqlx_migrations`.
- **Legacy databases**: On the first start against a database without `_sqlx_migrations` history, already applied versions are imported once from `refinery_schema_history`, `flyway_schema_history` or by schema inspection. The legacy tables are left untouched.

## 4. Verification & Testing

Verify migrations using cargo test against PostgreSQL (tests create and drop isolated throwaway databases):
```bash
cargo test --manifest-path backend/Cargo.toml --test migration_tests
```

## 5. Documentation

Update [`docs/arc42.md`](../../../docs/arc42.md) under Section 8 (Concepts / Persistence) and [`docs/Release-Info.md`](../../../docs/Release-Info.md) if the schema change introduces new domain models or alters existing relationships.

## 6. Troubleshooting

1. **Checksum mismatch** (`migration <n> was previously applied but has been modified`):
   A shipped migration file was edited. Revert the file to its committed content (`git checkout -- backend/migrations/<file>`) and put the change into a new migration.
2. **Docker / Postgres Reset (Development Only)**:
   If developing in local Docker and the database state becomes inconsistent:
   ```bash
   docker compose down -v
   docker compose up -d postgres backend
   ```
3. **Immutable Rule**: Never alter already committed/applied migrations in shared or production environments; always create a new incremental migration file (`<N+1>_….sql`).
