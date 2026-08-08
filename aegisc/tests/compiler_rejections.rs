use aegisc::{lexer, linear, parser};

fn check(source: &str) -> Result<(), String> {
    let tokens = lexer::lex(source)?;
    let program = parser::parse(&tokens)?;
    linear::check_program(&program)
}

fn adapter(body: &str) -> String {
    format!(
        "adapter DamageSystem for ApplyDamage {{ timeout: 16ms, max_retries: 0, execute(fenced Lease<ApplyDamage> lease) {{ {body} }} }}"
    )
}

#[test]
fn rejects_lease_leak() {
    let err = check(&adapter("lease.payload();")).unwrap_err();
    assert!(err.contains("E1003"), "unexpected error: {err}");
}

#[test]
fn rejects_use_after_commit() {
    let err = check(&adapter("lease.commit(result); lease.payload();")).unwrap_err();
    assert!(err.contains("E1001"), "unexpected error: {err}");
}

#[test]
fn rejects_double_commit() {
    let err = check(&adapter("lease.commit(result); lease.commit(result);" )).unwrap_err();
    assert!(err.contains("E1001"), "unexpected error: {err}");
}

#[test]
fn rejects_use_after_abort() {
    let err = check(&adapter("lease.abort(error); lease.payload();")).unwrap_err();
    assert!(err.contains("E1002"), "unexpected error: {err}");
}

#[test]
fn accepts_commit() {
    check(&adapter("lease.commit(result);" )).unwrap();
}

#[test]
fn accepts_abort() {
    check(&adapter("lease.abort(error);" )).unwrap();
}

#[test]
fn accepts_branch_when_both_paths_consume_lease() {
    check(&adapter(
        "if authorized { lease.commit(result); } else { lease.abort(error); }",
    ))
    .unwrap();
}

#[test]
fn rejects_branch_with_inconsistent_lease_consumption() {
    let err = check(&adapter(
        "if authorized { lease.commit(result); } else { lease.payload(); }",
    ))
    .unwrap_err();
    assert!(err.contains("E1006"), "unexpected error: {err}");
}
