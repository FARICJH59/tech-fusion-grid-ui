# aegisc v0.1

Aegis compiler prototype for linear `Lease<T>` execution.

## v0.1

- `.aegis` lexer
- parser and AST
- Intent / Policy / Adapter declarations
- `Lease<T>` adapter validation
- compile-time lease leak detection
- double commit / double abort detection
- use-after-consume detection
- compiler CLI

## Example

```text
adapter DamageSystem for ApplyDamage {
    timeout: 16ms,
    max_retries: 0,
    execute(fenced Lease<ApplyDamage> lease) {
        lease.commit(result);
    }
}
```

Build and run from `aegisc/` with Cargo:

```bash
cargo run -- examples/damage_system.aegis
```

## Next

v0.2 will add control-flow-aware CFG analysis, typed IR, policy effects, and fenced SQL/worker code generation.
