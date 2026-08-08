use std::collections::HashMap;
use crate::ast::*;
use crate::cfg::{ControlFlowGraph, LeaseState, Terminator};

pub fn check_program(program: &Program) -> Result<(), String> {
    for item in &program.items {
        if let Item::Adapter(adapter) = item { check_adapter(adapter)?; }
    }
    Ok(())
}

fn check_adapter(adapter: &AdapterDecl) -> Result<(), String> {
    let cfg = ControlFlowGraph::linear_body(&adapter.body);
    let mut states = HashMap::new();
    states.insert(adapter.lease_name.clone(), LeaseState::Live);
    verify_block(&cfg, cfg.entry, states, adapter, &mut Vec::new())
}

fn verify_block(
    cfg: &ControlFlowGraph,
    block_id: usize,
    mut states: HashMap<String, LeaseState>,
    adapter: &AdapterDecl,
    path: &mut Vec<usize>,
) -> Result<(), String> {
    if path.contains(&block_id) {
        return Err(format!("error[E1011]: cyclic control flow requires explicit lease loop semantics in adapter '{}'", adapter.name));
    }
    path.push(block_id);
    let block = &cfg.blocks[block_id];

    for stmt in &block.statements {
        match stmt {
            Stmt::Commit(n) => consume(&mut states, n, LeaseState::Committed, adapter)?,
            Stmt::Abort(n) => consume(&mut states, n, LeaseState::Aborted, adapter)?,
            Stmt::Use(n) => {
                if let Some(state) = states.get(n) {
                    if *state != LeaseState::Live {
                        return Err(format!("error[E1002]: use-after-consume of lease '{n}' in adapter '{}'", adapter.name));
                    }
                }
            }
        }
    }

    match block.terminator {
        Terminator::Exit => {
            match states.get(&adapter.lease_name) {
                Some(LeaseState::Committed | LeaseState::Aborted) => {}
                Some(LeaseState::Live) => return Err(format!(
                    "error[E1001]: unterminated lease '{}' on reachable exit path\nhelp: every execution path must finalize the lease exactly once",
                    adapter.lease_name
                )),
                None => return Err("error[E1005]: lease parameter disappeared during CFG analysis".into()),
            }
        }
        Terminator::Fallthrough => {}
        Terminator::Branch { then_block, else_block } => {
            let then_result = verify_block(cfg, then_block, states.clone(), adapter, path);
            let else_result = verify_block(cfg, else_block, states, adapter, path);
            then_result?;
            else_result?;
        }
    }

    path.pop();
    Ok(())
}

fn consume(
    states: &mut HashMap<String, LeaseState>,
    name: &str,
    next: LeaseState,
    adapter: &AdapterDecl,
) -> Result<(), String> {
    match states.get_mut(name) {
        Some(state) if *state == LeaseState::Live => { *state = next; Ok(()) }
        Some(LeaseState::Committed) => Err(format!("error[E1003]: lease '{name}' was already committed in adapter '{}'", adapter.name)),
        Some(LeaseState::Aborted) => Err(format!("error[E1004]: lease '{name}' was already aborted in adapter '{}'", adapter.name)),
        None => Err(format!("error[E1005]: '{name}' is not a known lease in adapter '{}'", adapter.name)),
    }
}
