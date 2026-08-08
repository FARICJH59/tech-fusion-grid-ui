use aegisc::runtime::RuntimeError;
use aegisc::sqlite_store::SqliteHandoffStore;
use sqlx::{sqlite::SqlitePoolOptions, Row};

#[tokio::test]
async fn sqlite_reclaim_fences_stale_worker() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .unwrap();

    sqlx::query(
        r#"
        CREATE TABLE execution_handoffs (
            handoff_id TEXT PRIMARY KEY,
            intent_type TEXT NOT NULL,
            status TEXT NOT NULL,
            worker_id TEXT,
            fencing_token INTEGER NOT NULL DEFAULT 0,
            lease_expires_at TEXT,
            created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%d %H:%M:%f', 'now')),
            payload_json TEXT NOT NULL,
            result_json TEXT,
            error_json TEXT
        )
        "#,
    )
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO execution_handoffs
            (handoff_id, intent_type, status, fencing_token, payload_json)
        VALUES
            ('termux-handoff-001', 'ApplyDamage', 'PENDING', 0, '{"damage":10}')
        "#,
    )
    .execute(&pool)
    .await
    .unwrap();

    let store = SqliteHandoffStore { pool: pool.clone() };

    let worker_a = store
        .claim_with_timeout("ApplyDamage", "worker-a", 16)
        .await
        .unwrap()
        .expect("worker A should claim");

    assert_eq!(worker_a.fencing_token.0, 1);

    sqlx::query(
        "UPDATE execution_handoffs SET lease_expires_at = '2000-01-01 00:00:00' WHERE handoff_id = ?",
    )
    .bind(&worker_a.handoff_id)
    .execute(&pool)
    .await
    .unwrap();

    let worker_b = store
        .claim_with_timeout("ApplyDamage", "worker-b", 16)
        .await
        .unwrap()
        .expect("worker B should reclaim");

    assert_eq!(worker_b.fencing_token.0, 2);

    assert_eq!(
        store.commit(&worker_a, "{\"worker\":\"worker-a\"}").await,
        Err(RuntimeError::StaleFence)
    );

    store
        .commit(&worker_b, "{\"worker\":\"worker-b\"}")
        .await
        .unwrap();

    let row = sqlx::query(
        "SELECT status, fencing_token, worker_id, result_json FROM execution_handoffs WHERE handoff_id = ?",
    )
    .bind("termux-handoff-001")
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(row.get::<String, _>("status"), "COMPLETED");
    assert_eq!(row.get::<i64, _>("fencing_token"), 2);
    assert_eq!(row.get::<String, _>("worker_id"), "worker-b");
    assert_eq!(
        row.get::<String, _>("result_json"),
        "{\"worker\":\"worker-b\"}"
    );
}
