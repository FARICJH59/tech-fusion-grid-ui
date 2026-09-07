# HOARE Cloudflare Edge Provider

The Cloudflare provider is a governed live-side-effect boundary. It is not a generic Cloudflare client.

## Execution contract

```text
AEGIS authorization
      -> TCX admission
      -> issuer-created GovernedExecutionAuthority
      -> tenant/zone binding
      -> hostname binding
      -> authority validation
      -> Cloudflare DNS mutation
      -> authority validation
      -> evidence / verification / receipt
```

The provider requires:

- an issuer-created runtime-branded `GovernedExecutionAuthority`;
- exact transaction and attempt identity;
- an explicit tenant-to-zone binding;
- an explicitly configured hostname;
- a DNS record identifier supplied by the governed transaction;
- a runtime credential provider.

The authority is never serialized to Cloudflare.

## Credentials

Production credentials must be supplied by an external secret/identity mechanism. Do not commit Cloudflare API tokens to source control or embed them in the request model.

The provider accepts either a short-lived/runtime credential callback or an explicitly injected token for controlled environments. Production deployments should prefer a centrally managed secret and rotation mechanism.

## Domain configuration

The existing `getCloudflareDomainConfig()` reads:

- `HOARE_PUBLIC_DOMAIN`
- `CLOUDFLARE_ZONE_ID`

No domain is hard-coded. No DNS change occurs merely because these values exist.

## Fail-closed behavior

The provider rejects before the external call when:

- authority is forged or invalid;
- tenant does not match authority;
- transaction or attempt does not match authority;
- tenant is not explicitly bound to the configured zone;
- record hostname does not exactly match the configured hostname;
- no credential provider exists;
- no runtime credential is returned.

The authority is revalidated immediately after the external Cloudflare mutation. If that validation fails, the operation is surfaced as failed/ambiguous and must be reconciled rather than silently committed.

## Scope

This phase implements governed DNS record mutation only. TLS, cache purge, WAF, Workers, Pages, and routing mutations should be added as separate capability-specific operations with their own contracts and evidence requirements.
