# HOARE Cloudflare Production Binding

## Target

The initial public edge hostname for HOARE is:

```text
hoare.ai
```

The hostname is configuration, not a hard-coded provider constant. The Cloudflare mutation boundary requires an explicit hostname and zone ID before it can be activated.

## Runtime configuration

Set these values in the deployment environment or secret/configuration system:

```text
HOARE_PUBLIC_DOMAIN=hoare.ai
CLOUDFLARE_ZONE_ID=<actual Cloudflare Zone ID>
```

Do not commit the real Zone ID if deployment policy treats it as sensitive configuration, and never commit the Cloudflare API token.

## Credential policy

Use a Cloudflare API token with the minimum zone-scoped permission required for the operation. DNS record mutations require `DNS Write`. Cloudflare's `Edit Zone DNS` token template provides that permission and can be restricted to the `hoare.ai` zone.

The application should resolve the credential at runtime through the existing credential-provider interface. Prefer the platform secret manager or another short-lived/rotated credential mechanism over a static token in source control.

## Tenant binding

The Cloudflare provider must receive an explicit mapping:

```text
<HOARE tenant ID> -> <hoare.ai Cloudflare Zone ID>
```

The provider rejects the operation if the transaction tenant is not mapped to the configured zone. The hostname in the requested DNS record must also exactly match the configured hostname after canonicalization.

## Governed mutation sequence

```text
AEGIS authorization
  -> TCX admission
  -> issuer-created GovernedExecutionAuthority
  -> tenant/zone binding
  -> hostname binding
  -> authority validation
  -> runtime credential resolution
  -> authority validation
  -> Cloudflare DNS mutation
  -> authority validation
  -> evidence / durable receipt
```

The opaque TCX authority is never serialized to Cloudflare.

## Activation gate

Production DNS mutation remains disabled until all of the following are present:

- `HOARE_PUBLIC_DOMAIN=hoare.ai`
- the real Cloudflare Zone ID for `hoare.ai`
- an explicit tenant-to-zone binding
- a runtime credential provider
- a narrowly scoped Cloudflare token with DNS Write for the intended zone
- a live TCX lease and fence
- issuer-created execution authority

A missing value or failed authority check must fail closed.

## DNSSEC

DNSSEC configuration should be treated as a separate governed operation. It must not be implicitly changed as a side effect of the initial DNS-record integration.
