#[cfg(test)]
mod tests {
    use aegisc::handoff_store::{HandoffStore, MemoryHandoffStore, Status};
    use aegisc::runtime::RuntimeError;

    #[test]
    fn claim_then_commit_completes_handoff() {
        let mut store = MemoryHandoffStore::default();
        store.insert("h1", "ApplyDamage", "payload");
        let lease = store.claim("ApplyDamage", "worker-1").unwrap().unwrap();
        store.commit(&lease).unwrap();
        assert_eq!(store.rows["h1"].status, Status::Completed);
    }

    #[test]
    fn wrong_worker_cannot_commit() {
        let mut store = MemoryHandoffStore::default();
        store.insert("h1", "ApplyDamage", "payload");
        let mut lease = store.claim("ApplyDamage", "worker-1").unwrap().unwrap();
        lease.worker_id = "worker-2".into();
        assert_eq!(store.commit(&lease), Err(RuntimeError::StaleFence));
    }

    #[test]
    fn only_pending_handoffs_are_claimed() {
        let mut store = MemoryHandoffStore::default();
        store.insert("h1", "ApplyDamage", "payload");
        let first = store.claim("ApplyDamage", "worker-1").unwrap().unwrap();
        assert!(store.claim("ApplyDamage", "worker-2").unwrap().is_none());
        store.abort(&first).unwrap();
        assert_eq!(store.rows["h1"].status, Status::Aborted);
    }
}
