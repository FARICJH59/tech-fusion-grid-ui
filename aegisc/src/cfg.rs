use crate::ast::Stmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LeaseState { Live, Committed, Aborted }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Terminator { Exit, Branch { then_block: usize, else_block: usize } }

#[derive(Debug, Clone)]
pub struct BasicBlock { pub id: usize, pub statements: Vec<Stmt>, pub terminator: Terminator }

#[derive(Debug, Clone)]
pub struct ControlFlowGraph { pub blocks: Vec<BasicBlock>, pub entry: usize }

impl ControlFlowGraph {
    pub fn from_body(body: &[Stmt]) -> Self {
        let mut cfg = Self { blocks: Vec::new(), entry: 0 };
        cfg.entry = cfg.lower_sequence(body);
        cfg
    }

    fn lower_sequence(&mut self, body: &[Stmt]) -> usize {
        let id = self.blocks.len();
        self.blocks.push(BasicBlock { id, statements: Vec::new(), terminator: Terminator::Exit });
        for stmt in body {
            match stmt {
                Stmt::If { then_body, else_body, .. } => {
                    let then_id = self.lower_sequence(then_body);
                    let else_id = self.lower_sequence(else_body);
                    self.blocks[id].terminator = Terminator::Branch { then_block: then_id, else_block: else_id };
                    return id;
                }
                _ => self.blocks[id].statements.push(stmt.clone()),
            }
        }
        id
    }
}
