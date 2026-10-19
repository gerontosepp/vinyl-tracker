use backend_rs::{
    config::Config,
    db::migrations::{MIGRATOR, run_migrations},
};
use sqlx::{PgPool, migrate::Migrator, postgres::PgPoolOptions};
use std::borrow::Cow;

/// Throwaway database that is dropped again when the test finishes.
struct TestDatabase {
    admin: PgPool,
    name: String,
    pool: PgPool,
}

impl TestDatabase {
    async fn create() -> Self {
        dotenvy::dotenv().ok();
        let config = Config::from_env();
        let admin = PgPoolOptions::new()
            .max_connections(1)
            .connect(&config.database_url)
            .await
            .expect("PostgreSQL must be accessible for integration tests");

        let name = format!("vt_mig_{:016x}", rand::random::<u64>());
        sqlx::query(&format!("CREATE DATABASE {name}"))
            .execute(&admin)
            .await
            .expect("Test user must be allowed to create databases");

        let mut url = url::Url::parse(&config.database_url).unwrap();
        url.set_path(&name);
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(url.as_str())
            .await
            .unwrap();

        Self { admin, name, pool }
    }

    async fn drop(self) {
        self.pool.close().await;
        sqlx::query(&format!("DROP DATABASE {} WITH (FORCE)", self.name))
            .execute(&self.admin)
            .await
            .unwrap();
    }

    /// Applies migrations up to `max_version` and then removes the sqlx history,
    /// leaving a schema that looks like it was created by a legacy tool.
    async fn create_legacy_schema(&self, max_version: i64) {
        let partial = partial_migrator(max_version);
        partial.run(&self.pool).await.unwrap();
        self.exec("DROP TABLE _sqlx_migrations").await;
    }

    async fn exec(&self, sql: &str) {
        sqlx::query(sql).execute(&self.pool).await.unwrap();
    }

    /// Returns (version, execution_time) rows; imported baseline rows have execution_time 0.
    async fn sqlx_history(&self) -> Vec<(i64, i64)> {
        sqlx::query_as("SELECT version, execution_time FROM _sqlx_migrations ORDER BY version")
            .fetch_all(&self.pool)
            .await
            .unwrap()
    }

    async fn column_exists(&self, table: &str, column: &str) -> bool {
        sqlx::query_scalar(
            "SELECT EXISTS (SELECT FROM information_schema.columns
                            WHERE table_name = $1 AND column_name = $2)",
        )
        .bind(table)
        .bind(column)
        .fetch_one(&self.pool)
        .await
        .unwrap()
    }
}

fn partial_migrator(max_version: i64) -> Migrator {
    Migrator {
        migrations: Cow::Owned(
            MIGRATOR
                .iter()
                .filter(|m| m.version <= max_version)
                .cloned()
                .collect(),
        ),
        ..Migrator::DEFAULT
    }
}

fn all_versions() -> Vec<i64> {
    MIGRATOR.iter().map(|m| m.version).collect()
}

fn imported(history: &[(i64, i64)]) -> Vec<i64> {
    history
        .iter()
        .filter(|(_, time)| *time == 0)
        .map(|(v, _)| *v)
        .collect()
}

fn executed(history: &[(i64, i64)]) -> Vec<i64> {
    history
        .iter()
        .filter(|(_, time)| *time > 0)
        .map(|(v, _)| *v)
        .collect()
}

#[tokio::test]
async fn test_fresh_database_applies_all_migrations_idempotently() {
    let db = TestDatabase::create().await;

    run_migrations(&db.pool)
        .await
        .expect("First run must succeed");
    let history = db.sqlx_history().await;
    assert_eq!(executed(&history), all_versions());
    assert!(db.column_exists("record_cache", "median_price").await);

    run_migrations(&db.pool)
        .await
        .expect("Second run must be a no-op");
    assert_eq!(db.sqlx_history().await, history);

    db.drop().await;
}

#[tokio::test]
async fn test_concurrent_runs_on_fresh_database_do_not_conflict() {
    let db = TestDatabase::create().await;

    let (a, b, c) = tokio::join!(
        run_migrations(&db.pool),
        run_migrations(&db.pool),
        run_migrations(&db.pool)
    );
    assert!(a.is_ok() && b.is_ok() && c.is_ok(), "{a:?} {b:?} {c:?}");
    assert_eq!(executed(&db.sqlx_history().await), all_versions());

    db.drop().await;
}

#[tokio::test]
async fn test_refinery_history_is_imported_without_rerunning_migrations() {
    let db = TestDatabase::create().await;
    db.create_legacy_schema(9).await;
    db.exec(
        "CREATE TABLE refinery_schema_history (
            version INT4 PRIMARY KEY, name VARCHAR(255), applied_on VARCHAR(255), checksum VARCHAR(255))",
    )
    .await;
    db.exec(
        "INSERT INTO refinery_schema_history (version, name)
         SELECT v, 'legacy' FROM generate_series(1, 9) AS v",
    )
    .await;

    run_migrations(&db.pool)
        .await
        .expect("Refinery-managed database must start without re-running migrations");
    let history = db.sqlx_history().await;
    assert_eq!(imported(&history), all_versions());
    assert!(executed(&history).is_empty());

    let refinery_rows: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM refinery_schema_history")
        .fetch_one(&db.pool)
        .await
        .unwrap();
    assert_eq!(refinery_rows, 9, "Legacy history must stay untouched");

    db.drop().await;
}

#[tokio::test]
async fn test_flyway_history_is_imported_and_pending_migrations_run() {
    let db = TestDatabase::create().await;
    db.create_legacy_schema(8).await;
    db.exec(
        "CREATE TABLE flyway_schema_history (
            installed_rank INT PRIMARY KEY, version VARCHAR(50), success BOOLEAN NOT NULL)",
    )
    .await;
    db.exec(
        "INSERT INTO flyway_schema_history (installed_rank, version, success)
         SELECT v, v::text, TRUE FROM generate_series(1, 8) AS v",
    )
    .await;
    db.exec("INSERT INTO flyway_schema_history VALUES (100, NULL, TRUE), (101, '9', FALSE)")
        .await;

    run_migrations(&db.pool).await.unwrap();
    let history = db.sqlx_history().await;
    assert_eq!(imported(&history), (1..=8).collect::<Vec<_>>());
    assert_eq!(
        executed(&history),
        vec![9],
        "Failed Flyway entries count as pending"
    );
    assert!(db.column_exists("record_cache", "median_price").await);

    db.drop().await;
}

#[tokio::test]
async fn test_schema_without_history_is_detected_heuristically() {
    let db = TestDatabase::create().await;
    db.create_legacy_schema(7).await;

    run_migrations(&db.pool).await.unwrap();
    let history = db.sqlx_history().await;
    assert_eq!(imported(&history), (1..=7).collect::<Vec<_>>());
    assert_eq!(executed(&history), vec![8, 9]);
    assert!(db.column_exists("collection_item", "media_condition").await);

    db.drop().await;
}

#[tokio::test]
async fn test_existing_sqlx_history_takes_precedence_over_legacy_tables() {
    let db = TestDatabase::create().await;
    partial_migrator(7).run(&db.pool).await.unwrap();
    db.exec("CREATE TABLE refinery_schema_history (version INT4 PRIMARY KEY)")
        .await;
    db.exec("INSERT INTO refinery_schema_history SELECT generate_series(1, 9)")
        .await;

    run_migrations(&db.pool).await.unwrap();
    let history = db.sqlx_history().await;
    assert!(imported(&history).is_empty());
    assert_eq!(executed(&history), all_versions());
    assert!(db.column_exists("record_cache", "median_price").await);

    db.drop().await;
}
