# HOARE Integration Gap Matrix

## Purpose

This document defines the integration boundary between the existing Tech Fusion Grid UI and the canonical HOARE platform components. The existing UI/Vercel deployment is the protected baseline; this layer is additive.

## Canonical ownership

| Capability | Canonical owner | Tech Fusion Grid UI role |
|---|---|---|
| WWW/UI | tech-fusion-grid-ui | Owns experience and current Vercel target |
| Tenant identity | HOARE | Consume canonical UUID `tenant_id` |
| Billing | Stripe + HOARE billing | Map Stripe customer/subscription to canonical tenant |
| GitHub import | HOARE project intake | Import repository metadata and immutable commit SHA |
| Project build/intake | PASOR | Adapter only; do not duplicate PASOR |
| Formal verification | AEGIS/AEGISC | Adapter only; fail closed |
| Agent execution | HOARE-AGENT | Governed adapter |
| Agent operating substrate | AgentFusion-Foundary | Consume runtime capabilities; do not duplicate |
| Control brain | HOARE.ai private control plane | Never expose as a tenant capability |
| Cloud governance | QGPS | Integration boundary only |
| Deployment | Deployment Fabric | Provider-neutral target interface |
| Current publishing | Vercel | Preserve existing behavior |
| Future publishing | Cloudflare/GCP/AWS/Azure/HOARE Native | Add adapters without replacing Vercel |

## Required request path

```text
Authenticated principal
  -> canonical tenant_id
  -> subscription/entitlement check
  -> project ownership check
  -> capability firewall
  -> PASOR (if build/change requested)
  -> AEGIS/AEGISC verification
  -> HOARE policy authorization
  -> AgentFusion/HOARE-Agent execution
  -> QGPS/deployment policy
  -> deployment target
```

## Security invariants

1. `tenant_id` is a HOARE-generated immutable UUID. Stripe IDs are external identifiers, not tenant IDs.
2. Every imported project is bound to exactly one canonical tenant.
3. Repository imports retain the actual immutable Git commit SHA used as source evidence.
4. PASOR and AEGIS/AEGISC adapters fail closed when their real service is unavailable or unconfigured.
5. Public tenants receive capabilities/entitlements, never unrestricted control-plane execution.
6. `enterprise_control` and equivalent private control capabilities are not public capabilities.
7. Existing Vercel behavior is preserved until a provider-neutral deployment adapter is proven.
8. Existing platform features are enhanced in place; parallel duplicate runtimes are prohibited.

## Remaining verification gates

- [ ] Confirm production Stripe customer/subscription -> tenant mapping with live webhook fixtures.
- [ ] Confirm GitHub App/OAuth installation and repository import against real credentials.
- [ ] Locate the canonical PASOR implementation and replace the adapter's placeholder transport with its real contract.
- [ ] Locate the canonical AEGIS/AEGISC implementation and connect its actual verification/proof result.
- [ ] Verify HOARE-Agent service authentication and replay protection.
- [ ] Verify subscription entitlement enforcement before project/agent execution.
- [ ] Verify QGPS integration rather than duplicating QGPS logic in the UI repository.
- [ ] Verify audit/evidence events cover import, build, verification, authorization, and deployment.
- [ ] Verify usage metering is tenant-scoped and tied to authorized execution.
- [ ] Verify distributed rate limiting and production secret management.
- [ ] Verify provider-neutral deployment interface while preserving Vercel.

## Explicitly not implemented here

PASOR, AEGIS/AEGISC, QGPS, HOARE control-brain knowledge, and AgentFusion runtime internals are not copied into this repository. Their canonical implementations must be discovered and integrated through stable service/API contracts.
