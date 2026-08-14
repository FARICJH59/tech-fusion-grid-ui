# Tenant Dispatch Admission

Tenant scope is enforced at the PASOR dispatch boundary. It is not an optional preflight check.

```text
ExecutionUnit
   ↓
Tenant Scope Admission
   ├── tenant/project/target/resource required
   ├── policy version required
   └── command must be authorized
   ↓
PASOR simulation/governance/provenance/quota gates
   ↓
Handler
```

A plan containing an unauthorized command is blocked before provider/runtime execution. This prevents a client workload, self-healing action, or HOARE self-target operation from escaping its tenant authorization boundary.
