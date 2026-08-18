# HOARE GitHub Actions Execution Fabric

This layer translates GitHub Actions fundamentals into provider-neutral HOARE control-plane primitives. GitHub Actions is an execution adapter; it is not the HOARE control plane.

```text
Intent
  ↓
HOARE Planner
  ↓
Action Authorization
  ↓
Environment Governance
  ↓
Runbook / Action Registry
  ↓
Identity Broker (short-lived credentials)
  ↓
Execution Coordinator
  ↓
GitHub Actions / Cloud Run / Kubernetes / Edge
  ↓
Observation + Verification
  ↓
Release Gate / Remediation / Audit
```

## Added control-plane boundaries

- **Action Authorization** — allowlist actions and classify autonomous versus approval-required risk.
- **Runbook Registry** — version reusable operational procedures rather than generating every procedure from scratch.
- **Environment Manager** — distinguish development, staging, and production autonomy and destructive-action controls.
- **Identity Broker contract** — require short-lived credentials and keep provider authentication outside the builder.
- **Execution Coordinator** — prevent conflicting concurrent operations with tenant/target/action leases.
- **Action SDK** — provide a provider-neutral contract for custom HOARE actions and optional rollback.
- **GitHub Actions Adapter** — dispatch and observe workflows without moving governance into GitHub-specific code.

## Security invariants

1. Authorization precedes execution.
2. Tenant and project context are mandatory.
3. Production and destructive operations can require explicit approval.
4. Provider credentials are short-lived and injected by the control plane.
5. CI validates the boundary but does not deploy.
6. Execution is correlated and coordinated to prevent duplicate/conflicting operations.
7. Existing artifact attestation, provenance, deployment verification, release gating, self-healing, and tenant metering remain upstream/downstream governance boundaries.

## Result

HOARE can use GitHub Actions as one execution substrate while retaining the ability to execute the same governed action model against GCP, AWS, Azure, Kubernetes, private runners, and edge infrastructure.
