# HOARE Secret Rotation Lifecycle

HOARE treats secret rotation as a governed lifecycle, not as an unrestricted storage operation.

## Lifecycle

```text
rotation schedule / operator intent
        -> AEGIS authorization
        -> TCX admission
        -> governed execution authority
        -> Secret Access Policy
        -> external credential rotation
        -> Secret Manager new immutable version
        -> governed rollout
        -> disable old version
        -> destroy old version after verification
        -> durable receipt / audit outcome
```

The secret value itself is never placed in the transaction envelope, durable receipt, policy record, or audit event.

## Policy boundary

Rotation, disablement, and destruction are distinct governed operations. A policy must explicitly permit the requested operation and match:

- tenant
- project
- secret
- environment
- operation (`rotate`, `disable`, or `destroy`)
- agent
- workload
- optional node
- optional runtime
- optional target version

No matching policy means deny before the external Secret Manager call. In particular, permission to disable a version does not implicitly authorize permanent destruction.

## Version strategy

Production workloads should bind to explicit immutable secret versions rather than relying on `latest`. This makes deployments reproducible and permits controlled rollback.

Old versions should be disabled before destruction and retained long enough to verify that workloads have successfully moved to the new version. Destruction is a separate governed operation and must never be an implicit side effect of rotation or disablement.

## GCP implementation

`GcpSecretRotationProvider` uses Application Default Credentials, including WIF-backed ADC, and calls Secret Manager directly. It does not contain service-account keys or static credentials.

The provider revalidates the runtime-branded TCX authority immediately before and after each external mutation. A stale, revoked, expired, cross-tenant, cross-attempt, or forged authority fails closed.

IAM remains an independent external authorization boundary. The runtime identity should receive only the Secret Manager permissions required for its lifecycle operation, with destruction granted separately from disablement where operationally feasible.

## Rotation safety

Rotation workflows should be reentrant and idempotent. If the external credential system is updated but the workflow is interrupted before the Secret Manager version is recorded, the transaction must reconcile rather than blindly generating another credential.

For rollout safety, a new version should be created first, validated, and progressively deployed. Once consumers have migrated successfully, the previous version can be disabled. Permanent destruction should occur only after the required verification/retention gate has passed.

## Audit

Audit records may contain:

- tenant ID
- project ID
- secret ID
- transaction ID
- attempt ID
- policy ID
- operation
- target/resolved version
- outcome
- timestamps
- failure code

Audit records must never contain the secret payload, access token, private key, password, or other secret material.
