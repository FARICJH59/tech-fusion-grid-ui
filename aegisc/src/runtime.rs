use std::marker::PhantomData;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FencingToken(pub i64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeaseState { Active, Committed, Aborted }

#[derive(Debug)]
pub struct Lease<T> {
    pub handoff_id: String,
    pub fencing_token: FencingToken,
    pub worker_id: String,
    pub payload: T,
    state: LeaseState,
    _marker: PhantomData<T>,
}

impl<T> Lease<T> {
    pub fn new(handoff_id: String, fencing_token: FencingToken, worker_id: String, payload: T) -> Self {
        Self { handoff_id, fencing_token, worker_id, payload, state: LeaseState::Active, _marker: PhantomData }
    }

    pub fn state(&self) -> LeaseState { self.state }

    pub fn commit(mut self) -> Result<T, RuntimeError> {
        self.ensure_active()?;
        self.state = LeaseState::Committed;
        Ok(self.payload)
    }

    pub fn abort(mut self) -> Result<T, RuntimeError> {
        self.ensure_active()?;
        self.state = LeaseState::Aborted;
        Ok(self.payload)
    }

    pub fn ensure_active(&self) -> Result<(), RuntimeError> {
        match self.state {
            LeaseState::Active => Ok(()),
            LeaseState::Committed => Err(RuntimeError::AlreadyCommitted),
            LeaseState::Aborted => Err(RuntimeError::AlreadyAborted),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RuntimeError {
    AlreadyCommitted,
    AlreadyAborted,
    StaleFence,
    WrongWorker,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Fence {
    pub handoff_id: String,
    pub fencing_token: FencingToken,
    pub worker_id: String,
}

impl Fence {
    pub fn validate<T>(&self, lease: &Lease<T>) -> Result<(), RuntimeError> {
        if self.handoff_id != lease.handoff_id || self.fencing_token != lease.fencing_token {
            return Err(RuntimeError::StaleFence);
        }
        if self.worker_id != lease.worker_id {
            return Err(RuntimeError::WrongWorker);
        }
        Ok(())
    }
}
