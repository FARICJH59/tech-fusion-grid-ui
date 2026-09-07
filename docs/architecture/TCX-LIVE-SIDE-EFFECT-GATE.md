# TCX Live Side-Effect Gate

## Security invariant

No tenant-triggerable live infrastructure mutation may occur unless the operation carries a TCX-issued, attempt-bound `GovernedExecutionAuthority`.

The authority binds:

- transaction identity
- execution attempt identity
- tenant identity
- lease identity
- state version
- AEGIS authorization decision
- verification proof

The provider must call `authority.assertValid()` immediately before invoking a live infrastructure SDK.

## Boundary

```text
AEGIS authorization + proof
            |
            v
       TCX admission
            |
            v
   TCX-issued authority
            |
            v
     runtime adapter
            |
            v
   provider authority check
            |
            v
       Cloud Run SDK
```

MQTT dispatch envelopes remain transport identity only. AEGIS proof identifiers are not trusted when supplied by transport and are therefore not added to the MQTT envelope.

## Current hardening

- `GovernedExecutionAuthority` is defined as the runtime side-effect contract.
- `RuntimeDeploymentRequest` carries the authority without making dry-run providers dependent on production credentials.
- `GcpRuntimeProvider` rejects missing authority, tenant mismatch, incomplete authority identity, and missing AEGIS proof binding before mutation.
- The final authority validation occurs immediately before `deployService()`.
- Builder runtime adapters propagate authority to providers and reject a live result when no authority was supplied.
- Negative tests cover missing authority, cross-tenant authority, missing proof binding, and validation ordering.

## Remaining gate work

The controller deployment, traffic migration, and rollback paths must be migrated to the same authority contract before production execution is enabled. A provider-level gate is necessary but not sufficient if another code path can invoke a live Cloud Run client directly.

Production WIF configuration and infrastructure provisioning remain separate concerns and must not be bypassed with static credentials.
