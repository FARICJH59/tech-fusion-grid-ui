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
    -> capability validation + atomic consumption
    -> Secret Manager access
    -> secret material only at the final controlled boundary
    -> Cloudflare DNS mutation
```

For Cloudflare production mutations, the capability is bound to a Secret Manager secret containing the Cloudflare API token. The token is resolved only at the final Cloudflare call through `CloudflareSecretCredentialResolver`; the capability record itself never contains the token.

The handle binds to the exact tenant, project, secret, transaction, attempt, agent, workload, environment, operation, and optional node/runtime/version.

## Security properties

- Handles contain no secret payload.
- Handles are short-lived; the issuer caps TTL at five minutes.
- Handles are bound to the current transaction attempt.
- Handles are bound to the exact workload and agent identity.
- Handles cannot be reused after atomic consumption.
- Revocation changes server-side capability state.
- Capability validation rechecks TCX authority before consumption.
- Expired capabilities fail closed.
- Capability possession alone does not replace IAM, AEGIS, TCX, or Secret Access Policy.
- Cloudflare credentials are not accepted from the capability itself; they are resolved through the governed Secret Manager boundary.

## Storage

`SecretCapabilityStore` is backend-neutral. The included in-memory implementation is for deterministic tests and local development. Production deployments should use a durable, tenant-isolated store with atomic create/get/revoke/consume semantics and a bounded retention policy.

The durable store should contain capability metadata only, never secret material.

## Cloudflare production binding

The Cloudflare provider remains a governed side-effect boundary. It requires:

- exact tenant-to-zone binding,
- exact hostname binding,
- runtime-branded TCX authority,
- transaction/attempt identity matching,
- authority validation immediately before credential resolution,
- authority validation immediately before the Cloudflare request,
- authority validation after the external mutation.

Cloudflare recommends API tokens over legacy global API keys, and the DNS write permission can be scoped to a specific zone. The production token should therefore be a narrowly scoped Cloudflare API token stored in Secret Manager, not a repository secret or static application environment value. citeturn0search2turn0search4turn0search9

For `hoare.ai`, the deployment binding remains explicit:

```text
HOARE_PUBLIC_DOMAIN=hoare.ai
CLOUDFLARE_ZONE_ID=<actual hoare.ai zone ID>
```

The zone ID and token are infrastructure secrets/configuration and must not be committed to the repository or pasted into source-controlled configuration.

## Why this boundary exists

Google Cloud recommends least-privilege Secret Manager IAM at the lowest applicable resource level. HOARE therefore treats a capability handle as an additional application-level narrowing layer rather than a substitute for IAM. Workload Identity Federation remains the preferred authentication model for external workloads and avoids long-lived service-account keys.

A compromised workload that obtains a handle should still be constrained by its exact transaction attempt, tenant, workload, operation, secret version, and short expiration window.

## Production requirements

Before production use, the capability store should provide:

1. atomic single-use consumption,
2. revocation propagation,
3. TTL expiration enforcement,
4. tenant-isolated persistence,
5. concurrency-safe compare-and-set semantics,
6. audit events containing identifiers and outcomes only,
7. no secret values in logs, traces, receipts, or capability records,
8. Cloudflare API tokens restricted to the required `DNS Write` zone scope,
9. Cloudflare credential resolution through Secret Manager/WIF rather than long-lived repository credentials.
