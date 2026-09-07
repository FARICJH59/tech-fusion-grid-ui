# HOARE Secret Plane

HOARE treats client credentials as governed capabilities, not ordinary environment variables.

## Architecture

```text
HOARE
  |
  +-- AEGIS authorization
  +-- TCX admission / transaction identity
  |
  v
SecretAccessRequest
  |
  v
GcpSecretManagerProvider
  |
  v
Google Secret Manager
```

The provider enforces:

- tenant-to-secret binding;
- project binding;
- runtime-branded TCX authority;
- exact transaction and attempt identity;
- authority validation immediately before and after the external secret read;
- fail-closed behavior for missing/empty secret material.

Secret material is never placed in dispatch envelopes, durable receipts, audit records, or source control.

## Runtime configuration

Use the existing `GOOGLE_CLOUD_PROJECT_ID` for the GCP project. A production deployment should construct the provider with an explicit tenant-to-secret binding and the existing ADC/WIF runtime identity.

Example secret resource:

```text
projects/<project-id>/secrets/<secret-id>/versions/<version>
```

The default provider version is `latest`; production workloads that require deterministic rollback should pin an explicit secret version during a governed rollout.

## IAM

Grant the workload only the minimum Secret Manager permission required for the secrets it actually consumes. Prefer secret-level IAM bindings or IAM Conditions over project-wide access. Google documents least-privilege Secret Manager access and recommends Workload Identity Federation to avoid unnecessary long-lived service-account keys.

## Multi-tenant rule

A tenant can only access secret IDs explicitly present in its tenant binding. A request for another tenant's secret or another GCP project is rejected before Secret Manager is called.

## Rotation

Secret rotation should be modeled as a governed HOARE transaction:

```text
create new version
 -> validate credential
 -> authorize rollout
 -> deploy workload
 -> verify
 -> commit
 -> revoke old version
 -> durable receipt
```

The receipt records identifiers and outcomes, never secret material.

## Backends

GCP Secret Manager is the first implementation. The `SecretProvider` contract is intentionally backend-neutral so AWS Secrets Manager, Azure Key Vault, HashiCorp Vault, or a customer-managed vault can be added without changing the HOARE authorization model.
