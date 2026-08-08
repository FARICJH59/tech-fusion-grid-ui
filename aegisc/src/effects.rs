use crate::ast::{Item, PolicyDecl, Program, Stmt};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Effect {
    Pure,
    ReadState,
    Network,
    DatabaseMutation,
    ExternalIo,
}

pub fn check_program(program: &Program) -> Result<(), String> {
    for item in &program.items {
        if let Item::Policy(policy) = item {
            check_policy(policy)?;
        }
    }
    Ok(())
}

fn check_policy(policy: &PolicyDecl) -> Result<(), String> {
    for stmt in &policy.body {
        check_stmt(stmt, policy)?;
    }
    Ok(())
}

fn check_stmt(stmt: &Stmt, policy: &PolicyDecl) -> Result<(), String> {
    match stmt {
        // Policy bodies currently permit only declarative/read-only expressions.
        // Lease mutation is deliberately rejected here because policies must be pure.
        Stmt::Commit(name) | Stmt::Abort(name) => Err(format!(
            "error[E3001]: policy '{}' performs a mutation through lease '{}'; policies must be pure",
            policy.name, name
        )),
        Stmt::Use(_) => Ok(()),
        Stmt::If { then_body, else_body, .. } => {
            for s in then_body { check_stmt(s, policy)?; }
            for s in else_body { check_stmt(s, policy)?; }
            Ok(())
        }
    }
}
