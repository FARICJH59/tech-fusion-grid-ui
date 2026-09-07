# HOARE Cloudflare Edge Provider

The Cloudflare provider is a governed live-side-effect boundary, not a generic Cloudflare client.

## Execution contract

```text
AEGIS authorization -> TCX admission -> issuer-created authority
-> tenant/zone binding -> hostname binding -> authority validation
-> Cloudflare DNS mutation -> authority validation
-> evidence -> verification -> reconciliation -> durable receipt
```

The provider requires an issuer-created runtime-branded `GovernedExecutionAuthority`, exact transaction/attempt identity, an explicit tenant-to-zone binding, an explicitly configured hostname, a DNS record identifier, and a runtime credential provider.

The authority is never serialized to Cloudflare.

## Credentials

Production credentials must come from an external secret/identity mechanism. Do not commit Cloudflare API tokens to source control or place them in the transaction request. The implementation supports a runtime credential callback and an explicitly injected token for controlled environments.

## Domain configuration

`getCloudflareDomainConfig()` reads `HOARE_PUBLIC_DOMAIN` and `CLOUDFLARE_ZONE_ID`. Configuration alone never mutates DNS.

## Fail-closed behavior

The provider rejects before the external call for forged/invalid authority, tenant mismatch, transaction/attempt mismatch, missing tenant-to-zone binding, hostname mismatch, missing credential provider, or missing runtime credential. Authority is revalidated immediately after the external mutation; a post-call authority failure must be reconciled rather than silently committed.

This phase implements governed DNS record mutation only. TLS, cache, WAF, Workers, Pages, and routing mutations should be separate capability-specific operations with their own contracts and evidence requirements.
