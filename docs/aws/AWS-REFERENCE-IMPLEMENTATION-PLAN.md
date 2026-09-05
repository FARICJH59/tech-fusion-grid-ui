# HOARE AWS Reference Implementation Plan

## Purpose

Build a staging-only AWS reference deployment without replacing the existing GCP/Cloudflare production architecture.

## Provider boundary

HOARE remains provider-neutral. AWS implementations must sit behind the existing infrastructure/provider adapter contracts.

## Initial AWS capability mapping

| HOARE capability | AWS reference service | Boundary |
|---|---|---|
| Compute/runtime | ECS/Fargate or EKS | AWS adapter |
| PostgreSQL | Amazon RDS for PostgreSQL | persistence adapter |
| Redis | ElastiCache for Redis/Valkey | cache adapter |
| Object/evidence storage | Amazon S3 | evidence adapter |
| Secrets | AWS Secrets Manager | secret adapter |
| Logs/metrics | CloudWatch | observability adapter |
| Identity | IAM roles / short-lived credentials | identity adapter |
| Network | VPC/security groups/private subnets | infrastructure |

The exact compute choice is a validation decision; do not claim production support until it has been tested.

## Required security properties

1. No long-lived AWS access keys in source, repository, CI variables, or images.
2. CI uses OIDC to assume an AWS IAM role.
3. Runtime uses an IAM role with least privilege.
4. Secrets are retrieved from Secrets Manager.
5. Customer/tenant data is never used as test evidence.
6. AEGISC evaluates application security policy before execution.
7. HOARE authorization remains the final application permission gate.
8. AWS IAM remains the infrastructure permission boundary.
9. Every reference action produces an auditable decision and outcome.

## Validation sequence

### V1 — Static

- Typecheck
- Lint
- Unit tests
- Dependency/security checks
- Verify no credentials are committed

### V2 — Provider adapter

- Instantiate AWS provider configuration
- Resolve region
- Resolve resource identities
- Report provider health
- Fail closed on missing credentials/configuration

### V3 — Staging deployment

Deploy only disposable staging resources.

### V4 — Security lifecycle

```text
intent
  -> plan
  -> AEGISC policy evaluation
  -> HOARE authorization
  -> AWS adapter
  -> AWS IAM
  -> execution
  -> verification
  -> evidence/audit
```

### V5 — Negative tests

The system must demonstrate that:

- an invalid tenant cannot execute;
- an unauthorized action is denied;
- an AEGISC-blocked action never reaches the AWS adapter;
- missing AWS identity fails closed;
- an invalid resource cannot be selected;
- execution failure produces an observable failure state;
- rollback/recovery does not bypass authorization.

## Exit criteria

The AWS reference deployment is not considered validated until all V1-V5 gates pass and evidence is captured.

Passing this plan does not imply AWS Partner Central approval, AWS Marketplace approval, FTR, AWS Specialization, FedRAMP, CMMC, ATO, or DoD authorization.
