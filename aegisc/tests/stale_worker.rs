#[cfg(test)]
mod tests {
    use aegisc::handoff_store::{HandoffStore, MemoryHandoffStore, Status};
    use aegisc::runtime::{FencingToken, RuntimeError};

    #[test]
    fn stale_worker_cannot_finalize_reclaimed_handoff() {
        let mut store = MemoryHandoffStore::default();
        store.insert("h1", "ApplyDamage", "payload");

        let worker_a = store.claim("ApplyDamage", "worker-a").unwrap().unwrap();

        // Simulate expiry/reclamation by advancing the handoff back to Pending.
        // A real SQL backend will perform this transition atomically when the lease expires.
        store.rows.get_mut("h1").unwrap().status = Status::Pending;

        let worker_b = store.claim("ApplyDamage", "worker-b").unwrap().unwrap();
        assert!(worker_b.fencing_token.0 > worker_a.fencing_token.0);

        assert_eq!(store.commit(&worker_a), Err(RuntimeError::StaleFence));
        store.commit(&worker_b).unwrap();
        assert_eq!(store.rows["h1"].status, Status::Completed);
    }

    #[test]
    fn fencing_token_is_monotonic_across_reclaims() {
        let mut store = MemoryHandoffStore::default();
        store.insert("h1", "ApplyDamage", "payload");

        let first = store.claim("ApplyDamage", "worker-a").unwrap().unwrap();
        store.rows.get_mut("h1").unwrap().status = Status::Pending;
        let second = store.claim("ApplyDamage", "worker-b").unwrap().unwrap();

        assert_eq!(first.fencing_token, FencingToken(1));
        assert_eq!(second.fencing_token, FencingToken(2));
    }
}
