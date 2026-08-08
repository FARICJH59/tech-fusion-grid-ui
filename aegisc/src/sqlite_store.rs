use sqlx::{Row, SqlitePool};
use crate::runtime::{FencingToken, Lease, RuntimeError};

pub struct SqliteHandoffStore { pub pool: SqlitePool }

impl SqliteHandoffStore {
    pub async fn claim<T: Send + 'static>(&self, intent: &str, worker_id: &str) -> Result<Option<Lease<String>>, sqlx::Error> {
        let mut tx = self.pool.begin().await?;
        let row = sqlx::query(r#"
            WITH eligible AS (
                SELECT handoff_id FROM execution_handoffs
                WHERE (status = 'PENDING' OR (status = 'CLAIMED' AND lease_expires_at < strftime('%Y-%m-%d %H:%M:%f', 'now')))
                  AND intent_type = ?
                ORDER BY created_at ASC LIMIT 1
            )
            UPDATE execution_handoffs
            SET status = 'CLAIMED', worker_id = ?, fencing_token = fencing_token + 1,
                lease_expires_at = strftime('%Y-%m-%d %H:%M:%f', 'now', '+16 milliseconds')
            WHERE handoff_id = (SELECT handoff_id FROM eligible)
            RETURNING handoff_id, fencing_token, payload_json;
        "#).bind(intent).bind(worker_id).fetch_optional(&mut *tx).await?;
        tx.commit().await?;
        Ok(row.map(|r| Lease::new(r.get::<String, _>("handoff_id"), FencingToken(r.get::<i64, _>("fencing_token")), worker_id.to_string(), r.get::<String, _>("payload_json"))))
    }

    pub async fn commit(&self, lease: &Lease<String>, result_json: &str) -> Result<(), RuntimeError> {
        let result = sqlx::query(r#"
            UPDATE execution_handoffs SET status = 'COMPLETED', result_json = ?
            WHERE handoff_id = ? AND fencing_token = ? AND worker_id = ? AND status = 'CLAIMED'
        "#).bind(result_json).bind(&lease.handoff_id).bind(lease.fencing_token.0).bind(&lease.worker_id).execute(&self.pool).await.map_err(|_| RuntimeError::StaleFence)?;
        if result.rows_affected() == 1 { Ok(()) } else { Err(RuntimeError::StaleFence) }
    }

    pub async fn abort(&self, lease: &Lease<String>, error_json: &str) -> Result<(), RuntimeError> {
        let result = sqlx::query(r#"
            UPDATE execution_handoffs SET status = 'ABORTED', error_json = ?
            WHERE handoff_id = ? AND fencing_token = ? AND worker_id = ? AND status = 'CLAIMED'
        "#).bind(error_json).bind(&lease.handoff_id).bind(lease.fencing_token.0).bind(&lease.worker_id).execute(&self.pool).await.map_err(|_| RuntimeError::StaleFence)?;
        if result.rows_affected() == 1 { Ok(()) } else { Err(RuntimeError::StaleFence) }
    }
}
