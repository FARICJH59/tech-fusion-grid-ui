use crate::ir::{AirOp, AirProgram};

/// Generates the SQL protocol for an AIR program.
/// The generated claim/commit predicates are intentionally explicit so a
/// backend cannot accidentally omit fencing-token or worker ownership checks.
pub fn generate_sql(air: &AirProgram) -> String {
    let intent = air.intent.replace('"', "");
    let claim = format!(
        "WITH eligible AS (\n  SELECT handoff_id FROM execution_handoffs\n  WHERE (status = 'PENDING' OR (status = 'CLAIMED' AND lease_expires_at < strftime('%Y-%m-%d %H:%M:%f', 'now')))\n    AND intent_type = '{intent}'\n  ORDER BY created_at ASC LIMIT 1\n)\nUPDATE execution_handoffs\nSET status = 'CLAIMED', worker_id = :worker_id,\n    fencing_token = fencing_token + 1,\n    lease_expires_at = strftime('%Y-%m-%d %H:%M:%f', 'now', '+{ms} milliseconds')\nWHERE handoff_id = (SELECT handoff_id FROM eligible)\nRETURNING handoff_id, fencing_token, payload_json;",
        ms = air.timeout_ms
    );

    let commit = "UPDATE execution_handoffs\nSET status = 'COMPLETED', result_json = :result_json\nWHERE handoff_id = :handoff_id\n  AND fencing_token = :fencing_token\n  AND worker_id = :worker_id;";

    let abort = "UPDATE execution_handoffs\nSET status = 'ABORTED', error_json = :error_json\nWHERE handoff_id = :handoff_id\n  AND fencing_token = :fencing_token\n  AND worker_id = :worker_id;";

    let mut out = String::new();
    for op in &air.ops {
        match op {
            AirOp::Claim { .. } => { out.push_str("-- CLAIM\n"); out.push_str(&claim); out.push('\n'); }
            AirOp::ValidateFence => out.push_str("-- VALIDATE_FENCE: token + worker ownership required by terminal writes\n"),
            AirOp::Execute => out.push_str("-- EXECUTE: generated worker invokes user adapter logic here\n"),
            AirOp::Commit => { out.push_str("-- COMMIT\n"); out.push_str(commit); out.push('\n'); }
            AirOp::Abort => { out.push_str("-- ABORT\n"); out.push_str(abort); out.push('\n'); }
            AirOp::Release => out.push_str("-- RELEASE: terminal transition is fenced; no blind release is emitted\n"),
        }
    }
    out
}
