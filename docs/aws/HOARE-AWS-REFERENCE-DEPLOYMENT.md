# HOARE AWS Reference Deployment

## Status

**Staging design — not production certification.**

This document defines the AWS reference deployment boundary for HOARE. It does not claim AWS Marketplace approval, AWS Foundational Technical Review, FedRAMP, CMMC, DoD authorization, ATO, or any other certification.

## Objective

Run the existing HOARE application and security architecture on AWS without replacing the provider-neutral control plane or the existing GCP deployment.

The deployment must prove the lifecycle:

```text
Customer intent
    -> HOARE planning
    -> AEGISC policy evaluation
    -> HOARE authorization
    -> AWS execution adapter
    -> verification
    -> evidence/audit
```

## Architecture boundary

```text
                         HOARE
                           |
                 Provider adapter contract
                           |
                         AWS
                           |
          +----------------+----------------+
          |                |                |
       Compute          Data/Cache       Security
          |                |                |
       Runtime       PostgreSQL/Redis    IAM/Secrets
          |
     Observability
          |
   CloudWatch / audit
```

HOARE remains the application/control-plane owner. AWS supplies infrastructure capabilities through adapters.

## Initial AWS capability mapping

| HOARE capability | AWS reference capability | Required status |
|---|---|---|
| Application runtime | ECS/Fargate or equivalent container runtime | staging |
| PostgreSQL | Amazon RDS for PostgreSQL | staging |
| Redis | Amazon ElastiCache for Redis/Valkey | staging |
| Secrets | AWS Secrets Manager | staging |
| Object/evidence storage | Amazon S3 | staging |
| Logs/metrics | Amazon CloudWatch | staging |
| Identity | IAM roles with short-lived credentials | staging |
| Network boundary | VPC/private subnets/security groups | staging |
| Edge integration | MQTT-compatible adapter / AWS IoT path | later staging |

The first reference deployment intentionally avoids requiring every HOARE service to be AWS-native before the core lifecycle is validated.

## Identity rule

No long-lived AWS access keys are to be committed to the repository, GitHub Actions secrets, application source, or deployment manifests.

CI/CD should authenticate with GitHub OIDC to an AWS IAM role. Runtime workloads should use AWS workload roles with least-privilege permissions.

## Security boundary

AEGISC and HOARE authorization remain upstream of AWS execution:

```text
Agent / workflow
      |
      v
Builder plan
      |
      v
AEGISC security decision
      |
      v
HOARE authorization
      |
      v
AWS adapter
      |
      v
AWS IAM authorization
      |
      v
AWS resource
```

AWS IAM is an infrastructure authorization layer; it does not replace HOARE mission/application policy.

## Validation gates

1. Container starts successfully in AWS staging.
2. Tenant-scoped request reaches the HOARE control plane.
3. Builder produces an execution plan.
4. AEGISC can allow a permitted plan.
5. AEGISC can deny a prohibited plan.
6. HOARE authorization remains the final application-level execution gate.
7. Approved execution reaches the AWS adapter.
8. Execution result is verified.
9. Evidence/audit records are produced.
10. Runtime secrets are supplied by AWS Secrets Manager or the selected runtime secret mechanism.
11. CI/CD uses OIDC-based AWS authentication.
12. No secret material is present in Git history or deployment artifacts.

## Non-goals for this stage

- AWS Marketplace publication
- AWS Partner Solution publication
- AWS Foundational Technical Review
- AWS Specialization
- FedRAMP/CMMC/DoD authorization claims
- production customer deployment

Those are subsequent validation and commercialization stages.
