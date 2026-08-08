use crate::ast::{AdapterDecl, Stmt};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AirOp {
    Claim { intent: String },
    ValidateFence,
    Execute,
    Commit,
    Abort,
    Release,
}

#[derive(Debug, Clone)]
pub struct AirProgram {
    pub adapter: String,
    pub intent: String,
    pub timeout_ms: u64,
    pub max_retries: u32,
    pub ops: Vec<AirOp>,
}

pub fn lower_adapter(adapter: &AdapterDecl) -> AirProgram {
    let mut ops = vec![
        AirOp::Claim { intent: adapter.target_intent.clone() },
        AirOp::ValidateFence,
        AirOp::Execute,
    ];

    let mut terminal = None;
    for stmt in &adapter.body {
        match stmt {
            Stmt::Commit(_) => terminal = Some(AirOp::Commit),
            Stmt::Abort(_) => terminal = Some(AirOp::Abort),
            _ => {}
        }
    }

    ops.push(terminal.unwrap_or(AirOp::Abort));
    ops.push(AirOp::Release);

    AirProgram {
        adapter: adapter.name.clone(),
        intent: adapter.target_intent.clone(),
        timeout_ms: adapter.timeout_ms,
        max_retries: adapter.max_retries,
        ops,
    }
}
