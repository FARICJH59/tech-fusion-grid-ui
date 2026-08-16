# HOARE Builder Stage 6 — Governed Execution

Stage 6 turns the Stage 5 planning and simulation layers into a controlled runtime admission path.

## Execution boundary

```text
Intent
  -> PASOR plan
  -> simulation
  -> governance / entitlement gate
  -> dependency-aware dispatch
  -> provider/runtime adapter
  -> execution record
  -> metering / provenance
```

The runtime dispatcher is **not** a compiler, cloud provider, payment processor, or AI reasoning engine. It is the enforcement boundary between a simulated plan and an actual runtime adapter.

## Invariants

1. Every execution unit must have a simulation decision.
2. The simulation execution order must contain every planned unit exactly once.
3. Dependencies must occur in an earlier simulation wave.
4. Independent units in the same wave may execute concurrently.
5. A dependency is complete only after its executor succeeds.
6. `DEFERRED`, `DENIED`, and `FAILED` dependencies block downstream execution in the current dispatch.
7. Runtime admission re-checks tenant activity, IAM role, capability, and quota immediately before execution.
8. Runtime adapters receive the canonical execution unit, never the internal intelligence proposal.
9. Denied/deferred work is not billable; metering consumes successful execution records.

## Provider-neutral adapters

The same dispatcher can route approved units to adapters for:

- C/C++ toolchains
- AEGISC
- Rust
- Python
- Node/TypeScript
- Cloud Run
- Kubernetes
- edge / Raspberry Pi 5
- Jetson
- HOARE-native runtimes

Provider selection remains downstream from PASOR.

## Revenue boundary

Stage 5 already contains metering and tenant-ledger primitives. Stage 6 guarantees that only successful runtime execution reaches the billable execution path. Durable payment collection remains outside the builder runtime and can be backed by the platform's billing provider.

## Self-targeting

The same contract applies when the target is HOARE itself:

`HOARE improvement intent -> PASOR -> simulation -> governance -> repository build/test -> deployment adapter -> verification`.

Self-targeting does not bypass governance or execution admission.
