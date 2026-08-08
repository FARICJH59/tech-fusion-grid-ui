use std::collections::HashMap;
use crate::runtime::{Fence, FencingToken, Lease, RuntimeError};

#[derive(Debug, Clone)]
pub struct Handoff<T> {
    pub handoff_id: String,
    pub intent_type: String,
    pub payload: T,
    pub status: Status,
    pub fencing_token: FencingToken,
    pub worker_id: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Status { Pending, Claimed, Completed, Aborted }

pub trait HandoffStore<T> {
    fn claim(&mut self, intent: &str, worker_id: &str) -> Result<Option<Lease<T>>, RuntimeError>;
    fn commit(&mut self, lease: &Lease<T>) -> Result<(), RuntimeError>;
    fn abort(&mut self, lease: &Lease<T>) -> Result<(), RuntimeError>;
}

#[derive(Debug, Default)]
pub struct MemoryHandoffStore<T> {
    pub rows: HashMap<String, Handoff<T>>,
    next_id: u64,
}

impl<T> MemoryHandoffStore<T> {
    pub fn insert(&mut self, handoff_id: impl Into<String>, intent: impl Into<String>, payload: T) {
        let id = handoff_id.into();
        self.rows.insert(id.clone(), Handoff {
            handoff_id: id,
            intent_type: intent.into(),
            payload,
            status: Status::Pending,
            fencing_token: FencingToken(0),
            worker_id: None,
        });
    }

    fn next_token(&mut self) -> FencingToken {
        self.next_id += 1;
        FencingToken(self.next_id as i64)
    }
}

impl<T: Clone> HandoffStore<T> for MemoryHandoffStore<T> {
    fn claim(&mut self, intent: &str, worker_id: &str) -> Result<Option<Lease<T>>, RuntimeError> {
        let id = self.rows.iter().find(|(_, row)| row.intent_type == intent && row.status == Status::Pending).map(|(id, _)| id.clone());
        let Some(id) = id else { return Ok(None); };
        let token = self.next_token();
        let row = self.rows.get_mut(&id).expect("selected row exists");
        row.status = Status::Claimed;
        row.fencing_token = token;
        row.worker_id = Some(worker_id.to_string());
        Ok(Some(Lease::new(id, token, worker_id.to_string(), row.payload.clone())))
    }

    fn commit(&mut self, lease: &Lease<T>) -> Result<(), RuntimeError> {
        let row = self.rows.get_mut(&lease.handoff_id).ok_or(RuntimeError::StaleFence)?;
        Fence { handoff_id: lease.handoff_id.clone(), fencing_token: lease.fencing_token, worker_id: lease.worker_id.clone() }.validate(lease)?;
        if row.status != Status::Claimed || row.fencing_token != lease.fencing_token || row.worker_id.as_deref() != Some(&lease.worker_id) { return Err(RuntimeError::StaleFence); }
        row.status = Status::Completed;
        Ok(())
    }

    fn abort(&mut self, lease: &Lease<T>) -> Result<(), RuntimeError> {
        let row = self.rows.get_mut(&lease.handoff_id).ok_or(RuntimeError::StaleFence)?;
        if row.status != Status::Claimed || row.fencing_token != lease.fencing_token || row.worker_id.as_deref() != Some(&lease.worker_id) { return Err(RuntimeError::StaleFence); }
        row.status = Status::Aborted;
        Ok(())
    }
}
