use std::collections::HashMap;
use crate::ast::{AdapterDecl, Item, Program, Stmt};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AegisType { Unit, Bool, Int, String, Json, Intent(String), Lease(String) }

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ownership { Owned, Consumed }

#[derive(Debug, Clone)]
pub struct TypeEnv { pub bindings: HashMap<String, (AegisType, Ownership)> }

impl TypeEnv {
    pub fn new() -> Self { Self { bindings: HashMap::new() } }
    pub fn bind_lease(&mut self, name: String, intent: String) {
        self.bindings.insert(name, (AegisType::Lease(intent), Ownership::Owned));
    }
    pub fn consume(&mut self, name: &str) -> Result<(), String> {
        match self.bindings.get_mut(name) {
            Some((AegisType::Lease(_), ownership)) if *ownership == Ownership::Owned => { *ownership = Ownership::Consumed; Ok(()) }
            Some((_, _)) => Err(format!("error[E2001]: '{name}' is not a Lease<T>")),
            None => Err(format!("error[E2002]: unknown binding '{name}'")),
        }
    }
    pub fn require_owned(&self, name: &str) -> Result<(), String> {
        match self.bindings.get(name) {
            Some((AegisType::Lease(_), Ownership::Owned)) => Ok(()),
            Some((AegisType::Lease(_), Ownership::Consumed)) => Err(format!("error[E2003]: use of consumed lease '{name}'")),
            Some(_) => Err(format!("error[E2001]: '{name}' is not a Lease<T>")),
            None => Err(format!("error[E2002]: unknown binding '{name}'")),
        }
    }
}

pub fn check_program(program: &Program) -> Result<(), String> {
    for item in &program.items { if let Item::Adapter(adapter) = item { check_adapter(adapter)?; } }
    Ok(())
}

fn check_adapter(adapter: &AdapterDecl) -> Result<(), String> {
    let mut env = TypeEnv::new();
    env.bind_lease(adapter.lease_name.clone(), adapter.target_intent.clone());
    check_statements(&mut env, &adapter.body)
}

fn check_statements(env: &mut TypeEnv, body: &[Stmt]) -> Result<(), String> {
    for stmt in body {
        match stmt {
            Stmt::Commit(name) | Stmt::Abort(name) => env.consume(name)?,
            Stmt::Use(name) => env.require_owned(name)?,
            Stmt::If { then_body, else_body, .. } => {
                let mut then_env = env.clone();
                let mut else_env = env.clone();
                check_statements(&mut then_env, then_body)?;
                check_statements(&mut else_env, else_body)?;
            }
        }
    }
    Ok(())
}
