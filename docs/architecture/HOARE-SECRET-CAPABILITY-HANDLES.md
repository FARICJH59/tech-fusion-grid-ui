# HOARE Secret Capability Handles

HOARE can issue a short-lived, non-secret capability reference after AEGIS authorization, TCX admission, and Secret Access Policy approval.

## Purpose

The capability handle is an opaque reference. It is not the secret value and it is not a replacement for Google Cloud IAM or TCX authority.

The intended flow is:

```text
AEGIS authorization
    -> TCX admission
    -> governed execution authority
    -> Secret Access Policy
    -> short-lived capability handle
    -> capability validation
    -> Secret Manager access
    -> secret material only at the final controlled boundary
```

The handle binds to the exact tenant, project, secret, transaction, attempt, agent, workload, environment, operation, and optional node/runtime/version.

## Security properties

- Handles contain no secret payload.
- Handles are short-lived; the issuer caps TTL at five minutes.
- Handles are bound to the current transaction attempt.
- Handles are bound to the exact workload and agent identity.
- Handles cannot be reused after consumption when a one-shot flow consumes them.
- Revocation changes server-side capability state.
- Capability validation rechecks TCX authority before returning an authorized record.
- Expired capabilities fail closed.
- Capability possession alone does not replace IAM, AEGIS, TCX, or Secret Access Policy.

## Storage

`SecretCapabilityStore` is backend-neutral. The included in-memory implementation is for deterministic tests and local development. Production deployments should use a durable, tenant-isolated store with atomic create/get/revoke/consume semantics and a bounded retention policy.

The durable store should contain capability metadata only, never secret material.

## Why this boundary exists

Google Cloud recommends least-privilege Secret Manager IAM at the lowest applicable resource level. HOARE therefore treats a capability handle as an additional application-level narrowing layer rather than a substitute for IAM. Workload Identity Federation remains the preferred authentication model for external workloads and avoids long-lived service-account keys.

A compromised workload that obtains a handle should still be constrained by its exact transaction attempt, tenant, workload, operation, and short expiration window.

## Production requirements

Before production use, the capability store should provide:

1. atomic single-use consumption,
2. revocation propagation,
3. TTL expiration enforcement,
4. tenant-isolated persistence,
5. concurrency-safe compare-and-set semantics,
6. audit events containing identifiers and outcomes only,
7. no secret values in logs, traces, receipts, or capability records.
