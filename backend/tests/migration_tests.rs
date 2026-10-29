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

    /// Returns (version, execution_time) rows.
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
    assert!(db.column_exists("manual_record_alias", "instance_id").await);

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
async fn test_pending_migrations_run_on_existing_history() {
    let db = TestDatabase::create().await;
    partial_migrator(7).run(&db.pool).await.unwrap();

    run_migrations(&db.pool).await.unwrap();
    assert_eq!(executed(&db.sqlx_history().await), all_versions());
    assert!(db.column_exists("record_cache", "median_price").await);

    db.drop().await;
}

#[tokio::test]
async fn test_unique_genres_migration_removes_duplicates_and_blocks_new_ones() {
    let db = TestDatabase::create().await;
    partial_migrator(15).run(&db.pool).await.unwrap();

    let record_id: i64 = sqlx::query_scalar(
        "INSERT INTO record_cache (discogs_id, title) VALUES (1, 'Posen') RETURNING id",
    )
    .fetch_one(&db.pool)
    .await
    .unwrap();
    for genre in ["Rock", "Rock", "Pop", "Rock"] {
        sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, $2)")
            .bind(record_id)
            .bind(genre)
            .execute(&db.pool)
            .await
            .unwrap();
    }

    run_migrations(&db.pool).await.unwrap();

    let mut genres: Vec<String> =
        sqlx::query_scalar("SELECT genre FROM record_genres WHERE record_id = $1")
            .bind(record_id)
            .fetch_all(&db.pool)
            .await
            .unwrap();
    genres.sort();
    assert_eq!(genres, ["Pop", "Rock"]);

    let duplicate = sqlx::query("INSERT INTO record_genres (record_id, genre) VALUES ($1, 'Pop')")
        .bind(record_id)
        .execute(&db.pool)
        .await;
    assert!(
        duplicate.is_err(),
        "the same genre must not be stored twice"
    );

    db.drop().await;
}
