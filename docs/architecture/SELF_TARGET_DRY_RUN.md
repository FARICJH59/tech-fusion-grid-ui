# HOARE Self-Target Dry Run

HOARE can represent a change to itself as a governed transaction without granting the transaction an execution bypass.

```text
Improve HOARE
    ↓
SelfTargetTransaction
    ↓
Release Gate
    ↓
DRY-RUN DECISION
    ├── denied → stop
    └── eligible → report only
```

A dry-run never deploys, changes the repository, changes the active runtime, or authorizes billing. It only proves that the candidate satisfies the release prerequisites.

The transaction ID is deterministic for the same target, mode, intent, candidate revision, and gate inputs, supporting replay and audit correlation.

A future production self-update may use the same transaction structure with `mode: "release"`, but the actual repository mutation and deployment remain separate governed execution units.
