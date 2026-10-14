use backend_rs::{
    config::Config,
    db::migrations::run_migrations,
};

#[tokio::test]
async fn test_run_migrations_idempotent() {
    dotenvy::dotenv().ok();
    let config = Config::from_env();

    // Running migrations against PostgreSQL must succeed
    let result = run_migrations(&config.database_url).await;
    assert!(result.is_ok(), "First run of migrations must succeed: {:?}", result.err());

    // Running a second time immediately must also be cleanly idempotent
    let second_run = run_migrations(&config.database_url).await;
    assert!(second_run.is_ok(), "Second run of migrations must be idempotent: {:?}", second_run.err());
}
