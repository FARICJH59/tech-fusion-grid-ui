use std::collections::HashMap;
use crate::ast::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum LeaseState { Live, Committed, Aborted }

pub fn check_program(program: &Program) -> Result<(), String> {
    for item in &program.items { if let Item::Adapter(a)=item { check_adapter(a)?; } }
    Ok(())
}

fn check_adapter(a: &AdapterDecl) -> Result<(), String> {
    let mut state=HashMap::new(); state.insert(a.lease_name.clone(), LeaseState::Live);
    for stmt in &a.body {
        match stmt {
            Stmt::Commit(n)=>consume(&mut state,n,LeaseState::Committed,a),
            Stmt::Abort(n)=>consume(&mut state,n,LeaseState::Aborted,a),
            Stmt::Use(n)=>{ if let Some(s)=state.get(n) { if *s != LeaseState::Live { return Err(format!("error[E1002]: use-after-consume of lease '{n}' in adapter '{}'",a.name)); } } Ok(()) }
        }?
    }
    match state.get(&a.lease_name) {
        Some(LeaseState::Committed|LeaseState::Aborted)=>Ok(()),
        Some(LeaseState::Live)=>Err(format!("error[E1001]: unterminated lease '{}'\nhelp: every fenced Lease<T> must be finalized exactly once with commit(...) or abort(...)",a.lease_name)),
        None=>Err("error[E1005]: lease parameter disappeared during analysis".into()),
    }
}

fn consume(states:&mut HashMap<String,LeaseState>,name:&str,next:LeaseState,a:&AdapterDecl)->Result<(),String>{
    match states.get_mut(name) {
        Some(s) if *s==LeaseState::Live=>{*s=next;Ok(())},
        Some(LeaseState::Committed)=>Err(format!("error[E1003]: lease '{name}' was already committed")),
        Some(LeaseState::Aborted)=>Err(format!("error[E1004]: lease '{name}' was already aborted")),
        None=>Err(format!("error[E1005]: '{name}' is not a known lease in adapter '{}'",a.name)),
    }
}
