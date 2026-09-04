---
name: database-migrations
description: >-
  Guide and best practices for creating and applying Flyway database migrations,
  updating JPA entities, and maintaining PostgreSQL schema consistency in Vinyl Tracker.
---

# Vinyl Tracker Database Migrations Skill

This skill defines the process for evolving the PostgreSQL schema using Flyway migrations alongside Spring Data JPA entities.

## 1. Migration File Conventions

Flyway scripts are stored in:
`backend/src/main/resources/db/migration/`

Naming convention:
`V<VERSION>__<DESCRIPTION>.sql` (Note the double underscore `__`)

*Example*: `V3__add_album_notes.sql`

### Best Practices for Migration Scripts
- **PostgreSQL Compatibility**: Use valid PostgreSQL syntax.
- **Idempotency & Safety**: Use `IF NOT EXISTS` where applicable for indexes and tables.
- **Explicit Constraints**: Always provide explicit names for foreign keys and indexes (e.g. `idx_<table_name>_<column_name>`).
- **UTC Timestamps**: Use `TIMESTAMP WITHOUT TIME ZONE` or `TIMESTAMPTZ` consistent with the existing schema and store timestamps in UTC.
- **Never Modify Applied Migrations**: Once committed, previous migration scripts (`V1`, `V2`, etc.) must never be edited; create a new incremental version script instead.

## 2. JPA Entity & Schema Synchronization

When changing the schema:
1. **Flyway Migration First**: Write the SQL migration script in `src/main/resources/db/migration/`.
2. **Update JPA Entities**: Modify or create entities under `com.antigravity.vinyltracker.model`.
   - Use Lombok (`@Getter`, `@Setter`, `@NoArgsConstructor`, etc.).
   - Follow strict UTC rules: Use `LocalDateTime` representing UTC for all date/time fields.
3. **Update DTOs & Mappings**: Keep `com.antigravity.vinyltracker.model.dto` synchronized.
4. **Update Repositories**: Adjust query methods and `@Query` annotations in `com.antigravity.vinyltracker.repository`.

## 3. Flyway Configuration Rules

In `application.properties` / `application-prod.properties` / `docker-compose*.yml`:
- **Development**: Flyway is enabled by default. Hibernate `ddl-auto` is set to `validate` or `none` when Flyway manages schema.
- **Production & Registry Deployments**: `SPRING_FLYWAY_BASELINE_ON_MIGRATE=true` ensures seamless migrations against existing databases without errors.

## 4. Verification & Testing

Verify migrations against an in-memory or Testcontainers PostgreSQL instance:
```bash
cd backend
# Runs integration tests against PostgreSQL via Testcontainers:
mvn verify -Dtest=*IntegrationTest,*IT
cd ..
```

## 5. Documentation

Update [`docs/arc42.md`](file:///home/opolm/develop/vinyl-tracker/docs/arc42.md) under Section 8 (Concepts / Persistence) and [`docs/Release-Info.md`](file:///home/opolm/develop/vinyl-tracker/docs/Release-Info.md) if the schema change introduces new domain models or alters existing relationships.
