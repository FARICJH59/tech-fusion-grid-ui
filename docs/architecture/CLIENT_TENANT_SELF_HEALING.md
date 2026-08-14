# Client Tenant Self-Healing

HOARE self-healing applies to client projects through the same governed execution plane used by HOARE itself.

Every remediation is scoped to a tenant, project, target, environment, resource, provider, policy version, and explicitly authorized action set.

```text
Client Tenant
    ↓
Project
    ↓
Target / Environment / Resource
    ↓
Incident
    ↓
Remediation ExecutionUnit
    ↓
Tenant Scope Check
    ↓
Simulation + Governance + Quota + Provenance
    ↓
Runtime Adapter
    ↓
Recovery Verification
    ↓
Metering / Audit
```

A client remediation cannot be authorized merely because the action is globally supported by HOARE. The action must also be present in that tenant's policy and bound to the requested project/resource scope.

The same model can represent `target=hoare` for HOARE's own systems or `target=<client target>` for a customer workload. This makes self-healing a platform capability while preserving tenant isolation.
