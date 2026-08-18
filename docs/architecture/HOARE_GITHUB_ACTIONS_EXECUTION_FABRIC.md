# HOARE GitHub Actions Execution Fabric

## Architectural position

HOARE owns the customer-facing workflow abstraction. GitHub Actions is an optional execution adapter.

```text
CUSTOMER
   ↓
Intent
   ↓
HOARE
   ├── Understand
   ├── Plan
   ├── Policy
   ├── Authorize
   └── Construct HOARE Workflow
              ↓
        HOARE Workflow
              ↓
       Execution Fabric
        ┌─────┼─────┬─────┐
        ▼     ▼     ▼     ▼
      GitHub GCP   AWS   Azure ...
      Actions
```

## Native workflow source of truth

`HoareWorkflow` is the canonical representation of customer intent after planning and governance. Provider-specific workflow syntax is an implementation detail.

A customer does not need to know GitHub Actions YAML.

For example:

> Deploy my application to Google Cloud Run in production, run security checks, verify health, and roll back on failed verification.

HOARE constructs a workflow containing the trigger, environment, policy, identity requirements, actions, dependencies, concurrency, execution target, verification, rollback, observability, and audit context.

## GitHub Actions role

GitHub Actions remains valuable for customers that already use GitHub repositories, environments, runners, and workflows. HOARE can compile or dispatch governed work through the GitHub Actions adapter without transferring control-plane authority to GitHub.

Direct GCP, AWS, Azure, Kubernetes, private-runner, and edge adapters can execute the same native workflow contract without GitHub Actions.

## Control-plane invariant

**HOARE Workflow ≠ GitHub Workflow.**

HOARE retains authority over:

- intent
- planning
- policy
- authorization
- environment governance
- identity
- tenant isolation
- execution coordination
- provenance
- verification
- remediation
- audit
- metering

Execution adapters only translate and execute an already-governed plan.

## Existing governance boundaries

The execution fabric composes with artifact attestation, deployment verification, release gates, self-healing, tenant isolation, and metering already established in the deployment architecture.

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
      ├── Success → Audit / Metering
      └── Failure → Remediation / Rollback → Verification
```
