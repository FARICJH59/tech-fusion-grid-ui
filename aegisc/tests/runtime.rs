#[cfg(test)]
mod tests {
    use aegisc::runtime::{Fence, FencingToken, Lease, LeaseState, RuntimeError};

    #[test]
    fn commit_consumes_lease() {
        let lease = Lease::new("h1".into(), FencingToken(7), "w1".into(), 42);
        let result = lease.commit().unwrap();
        assert_eq!(result, 42);
    }

    #[test]
    fn stale_fence_is_rejected() {
        let lease = Lease::new("h1".into(), FencingToken(7), "w1".into(), 42);
        let fence = Fence { handoff_id: "h1".into(), fencing_token: FencingToken(6), worker_id: "w1".into() };
        assert_eq!(fence.validate(&lease), Err(RuntimeError::StaleFence));
    }

    #[test]
    fn wrong_worker_is_rejected() {
        let lease = Lease::new("h1".into(), FencingToken(7), "w1".into(), 42);
        let fence = Fence { handoff_id: "h1".into(), fencing_token: FencingToken(7), worker_id: "w2".into() };
        assert_eq!(fence.validate(&lease), Err(RuntimeError::WrongWorker));
    }

    #[test]
    fn new_lease_is_active() {
        let lease = Lease::new("h1".into(), FencingToken(7), "w1".into(), 42);
        assert_eq!(lease.state(), LeaseState::Active);
    }
}
