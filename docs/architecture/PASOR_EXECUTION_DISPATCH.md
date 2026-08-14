# Canonical PASOR Execution Dispatch

All governed execution workloads use the same dispatcher contract.

```text
Intent
  ↓
PASOR Plan
  ↓
ExecutionUnit DAG
  ↓
Simulation approval
  ↓
Governance approval
  ↓
Provenance verification
  ↓
Quota check
  ↓
Command handler
  ↓
Outcome / audit
```

Self-healing remediation is not granted a privileged execution path. A remediation becomes an `ExecutionUnit` with a command ID, parameters, dependencies, simulation hash, provenance hash, and cost metadata.

Self-targeting HOARE changes use the same path. Provider-specific actions are registered as handlers/adapters at the edge of the dispatcher.

The dispatcher itself does not contain provider SDK initialization, billing authorization, or credential material. Those remain control-plane concerns.
