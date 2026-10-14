---
name: database-migrations
description: >-
  Guide and best practices for creating and applying Refinery database migrations,
  updating SQLx models, and maintaining PostgreSQL schema consistency in Vinyl Tracker.
---

# Vinyl Tracker Database Migrations Skill

This skill defines the process for evolving the PostgreSQL schema using Refinery migrations alongside SQLx models.

## 1. Migration File Conventions

Refinery scripts are stored in:
`backend/migrations/`

Naming convention:
`V<VERSION>__<DESCRIPTION>.sql` (Note the double underscore `__`)

*Example*: `V10__add_new_feature.sql`

### Best Practices for Migration Scripts
- **PostgreSQL Compatibility**: Use valid PostgreSQL syntax.
- **Idempotency & Safety**: Use `IF NOT EXISTS` where applicable for indexes and tables.
- **Explicit Constraints**: Always provide explicit names for foreign keys and indexes (e.g. `idx_<table_name>_<column_name>`).
- **UTC Timestamps**: Use `TIMESTAMP WITHOUT TIME ZONE` or `TIMESTAMPTZ` consistent with the existing schema and store timestamps in UTC.
- **Never Modify Applied Migrations**: Once committed, previous migration scripts (`V1`..`V9`) must never be edited; create a new incremental version script instead.

## 2. SQLx Models & Schema Synchronization

When changing the schema:
1. **Refinery Migration First**: Write the SQL migration script in `backend/migrations/`.
2. **Update SQLx Models**: Modify or create domain models under `backend/src/models/`.
   - Follow strict UTC rules: Use `chrono::DateTime<Utc>` or `chrono::NaiveDateTime` for all date/time fields.
3. **Update Queries / Services**: Adjust SQLx queries in `backend/src/services/` or `backend/src/routes/`.

## 3. Migration Execution

- **Automatic Startup Migration**: `backend/src/db/migrations.rs` automatically applies pending migrations on server startup. It detects both existing Flyway schemas and clean databases seamlessly.

## 4. Verification & Testing

Verify migrations using cargo test against PostgreSQL:
```bash
cargo test --manifest-path backend/Cargo.toml --test migration_tests
```

## 5. Documentation

Update [`docs/arc42.md`](../../../docs/arc42.md) under Section 8 (Concepts / Persistence) and [`docs/Release-Info.md`](../../../docs/Release-Info.md) if the schema change introduces new domain models or alters existing relationships.

## 6. Troubleshooting & Checksum Repair

If a migration was edited locally before being released and Flyway halts with a validation error (`Validate failed: Migrations have failed validation: Checksum mismatch`):
1. **Flyway Repair**:
   ```bash
   cd backend
   mvn flyway:repair
   cd ..
   ```
2. **Docker / Postgres Reset (Development Only)**:
   If developing in local Docker and the database state becomes inconsistent:
   ```bash
   docker compose down -v
   docker compose up -d postgres backend
   ```
3. **Immutable Rule**: Never alter already committed/applied migrations in shared or production environments; always create a new incremental migration file (`V<N+1>__...sql`).
