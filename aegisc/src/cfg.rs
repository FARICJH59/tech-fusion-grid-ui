use crate::ast::Stmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeaseState {
    Live,
    Committed,
    Aborted,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Terminator {
    Fallthrough,
    Branch { then_block: usize, else_block: usize },
    Exit,
}

#[derive(Debug, Clone)]
pub struct BasicBlock {
    pub id: usize,
    pub statements: Vec<Stmt>,
    pub terminator: Terminator,
}

#[derive(Debug, Clone)]
pub struct ControlFlowGraph {
    pub blocks: Vec<BasicBlock>,
    pub entry: usize,
}

impl ControlFlowGraph {
    pub fn linear_body(body: &[Stmt]) -> Self {
        Self {
            blocks: vec![BasicBlock {
                id: 0,
                statements: body.to_vec(),
                terminator: Terminator::Exit,
            }],
            entry: 0,
        }
    }
}
