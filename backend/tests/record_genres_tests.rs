use backend_rs::{
    config::Config,
    db::init_pool,
    services::record_genres::{add_genres, replace_genres},
};
use sqlx::PgPool;

/// Cached record with a random Discogs ID, so parallel test runs do not collide.
struct TestRecord {
    pool: PgPool,
    id: i64,
}

impl TestRecord {
    async fn create() -> Self {
        dotenvy::dotenv().ok();
        let config = Config::from_env();
        let pool = init_pool(&config)
            .await
            .expect("PostgreSQL must be accessible for integration tests");
        backend_rs::db::migrations::run_migrations(&pool)
            .await
            .expect("Database migrations must succeed for integration tests");
        let id: i64 = sqlx::query_scalar(
            "INSERT INTO record_cache (discogs_id, title) VALUES ($1, 'Genres') RETURNING id",
        )
        .bind(i64::from(rand::random::<u32>()) + 5_000_000_000)
        .fetch_one(&pool)
        .await
        .unwrap();
        Self { pool, id }
    }

    async fn genres(&self) -> Vec<String> {
        sqlx::query_scalar("SELECT genre FROM record_genres WHERE record_id = $1 ORDER BY genre")
            .bind(self.id)
            .fetch_all(&self.pool)
            .await
            .unwrap()
    }

    async fn drop(self) {
        sqlx::query("DELETE FROM record_genres WHERE record_id = $1")
            .bind(self.id)
            .execute(&self.pool)
            .await
            .unwrap();
        sqlx::query("DELETE FROM record_cache WHERE id = $1")
            .bind(self.id)
            .execute(&self.pool)
            .await
            .unwrap();
    }
}

fn names(genres: &[&str]) -> Vec<String> {
    genres.iter().map(ToString::to_string).collect()
}

#[tokio::test]
async fn test_concurrent_replace_stores_every_genre_once() {
    let record = TestRecord::create().await;
    let genres = names(&["Rock", "Pop"]);

    let writers: Vec<_> = (0..16)
        .map(|_| {
            let pool = record.pool.clone();
            let genres = genres.clone();
            let id = record.id;
            tokio::spawn(async move { replace_genres(&pool, id, &genres).await })
        })
        .collect();
    for writer in writers {
        writer.await.unwrap().unwrap();
    }

    assert_eq!(record.genres().await, ["Pop", "Rock"]);
    record.drop().await;
}

#[tokio::test]
async fn test_replace_removes_other_genres_and_ignores_duplicates_in_the_input() {
    let record = TestRecord::create().await;
    replace_genres(&record.pool, record.id, &names(&["Rock", "Jazz"]))
        .await
        .unwrap();

    replace_genres(&record.pool, record.id, &names(&["Pop", "Rock", "Pop"]))
        .await
        .unwrap();
    assert_eq!(record.genres().await, ["Pop", "Rock"]);

    replace_genres(&record.pool, record.id, &[]).await.unwrap();
    assert!(record.genres().await.is_empty());
    record.drop().await;
}

#[tokio::test]
async fn test_add_keeps_existing_genres_and_does_not_repeat_them() {
    let record = TestRecord::create().await;
    add_genres(&record.pool, record.id, &names(&["Rock"]))
        .await
        .unwrap();

    add_genres(&record.pool, record.id, &names(&["Rock", "Pop"]))
        .await
        .unwrap();
    add_genres(&record.pool, record.id, &names(&["Pop"]))
        .await
        .unwrap();

    assert_eq!(record.genres().await, ["Pop", "Rock"]);
    record.drop().await;
}
