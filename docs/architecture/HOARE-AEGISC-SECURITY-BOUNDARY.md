# HOARE + AEGISC Security Boundary

AEGISC and HOARE have separate responsibilities.

```text
Security Policy Source
        ↓
      AEGISC
 policy language/compiler
        ↓
Compiled Security Policy Artifact
        ↓
      HOARE
 runtime evaluation + control plane
        ↓
Resource Inventory
        ↓
Resource Planner
        ↓
Existing Authorization Engine
        ↓
Provider Adapter
        ↓
Execution / Verification
```

## Ownership

- **AEGISC** defines and compiles security intent and invariants.
- **HOARE** evaluates the compiled artifact against workload requirements and infrastructure inventory.
- **HOARE authorization** remains the runtime permission gate.
- **Provider adapters** execute approved actions.

This boundary is additive. It does not replace the existing Builder, authorization, execution, verification, or reconciliation features.

A policy digest is carried with the compiled artifact. Cryptographic signature verification is a future hardening step; the current digest is not treated as proof of authenticity.
