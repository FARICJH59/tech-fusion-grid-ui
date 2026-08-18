# HOARE Native Workflow Model

## Principle

Customers express intent to HOARE. HOARE creates and governs a native `HoareWorkflow`. Execution providers are adapters behind that contract.

```text
Customer
   ↓
Intent
   ↓
HOARE
   ├── understand
   ├── plan
   ├── policy
   ├── authorize
   ├── select environment
   └── construct workflow
          ↓
    HOARE Workflow
          ↓
    Execution Fabric
      ├── GitHub Actions
      ├── GCP
      ├── AWS
      ├── Azure
      ├── Kubernetes
      ├── private runners
      └── edge
```

## Customer experience

A customer should not need to know GitHub Actions YAML to request a deployment.

Example intent:

> Deploy my application to Google Cloud Run in production, run security checks, verify health, and roll back automatically if verification fails.

HOARE translates that intent into a governed workflow containing:

- trigger
- inputs
- environment
- policy
- identity requirements
- actions
- action dependencies
- concurrency rules
- approvals
- execution target
- verification
- rollback
- observability
- audit context

## Provider independence

A single workflow can be compiled for different execution substrates:

```text
HOARE Workflow
      │
      ├── GitHub Actions adapter
      ├── GCP adapter
      ├── AWS adapter
      ├── Azure adapter
      └── Kubernetes adapter
```

The workflow contract remains stable while the execution implementation changes.

## Architectural invariant

**HOARE Workflow ≠ GitHub Workflow.**

A GitHub Actions workflow is one possible provider-specific representation of a HOARE workflow. GitHub Actions must never become the source of truth for HOARE intent, authorization, policy, identity, tenant governance, verification, or remediation.

## Lifecycle

```text
Customer Intent
      ↓
Workflow Generation
      ↓
Validation
      ↓
Policy Evaluation
      ↓
Authorization
      ↓
Identity Acquisition
      ↓
Execution Planning
      ↓
Provider Adapter
      ↓
Execution
      ↓
Observation
      ↓
Verification
      ↓
Success ───────────────→ Audit / Metering
      │
      └─ Failure → Remediation / Rollback → Verification
```

This model allows HOARE to own the customer-facing workflow abstraction while preserving compatibility with existing enterprise CI/CD infrastructure.
