# Canonical Architecture Audit

Status: integration audit / no production merge

## Purpose

`tech-fusion-grid-ui` is the commercial/project-facing surface for the latest HOARE architecture. Older Auto-Dev, UACO, AgentFusion, and HOARE repositories are treated as capability lineage and canonical subsystem candidates, not as independent products to be copied wholesale.

## Canonical ownership

| Capability | Canonical owner | TechFusion role |
|---|---|---|
| Tenant identity, subscription, entitlements | HOARE/TechFusion control-plane data model | Enforce tenant boundary |
| Billing | Stripe integration | Map Stripe IDs to immutable HOARE `tenant_id` |
| GitHub project intake | AgentFusion GitHub integration + TechFusion project boundary | Import repository and pin exact commit SHA |
| Agent runtime | HOARE-Agent / AgentFusion | Invoke through authenticated capability boundary |
| Workflow/orchestration | AgentFusion / HOARE | Consume, do not duplicate |
| QGPS | HOARE QGPS integration/control plane | Submit governed tasks; never expose control brain |
| PASOR | Latest project-build pipeline (canonical implementation still to be identified) | Adapter only until verified |
| AEGIS/AEGISC | Latest verification/compiler implementation (canonical implementation still to be identified) | Verification gate only until verified |
| Deployment | Provider-neutral deployment fabric | Vercel remains current target; other providers become adapters |
| Private knowledge/control brain | HOARE.ai | NEVER expose as tenant capability |

## Security invariants

1. `tenant_id` is a HOARE-owned immutable identifier. Stripe customer/subscription IDs are provider identifiers, not tenant identity.
2. GitHub source is pinned by the actual 40-character commit SHA.
3. PASOR cannot publish directly.
4. AEGIS/AEGISC is a required verification gate for governed builds.
5. Public tenants receive explicit capabilities/entitlements, never unrestricted control-plane execution.
6. `enterprise_control` is private/control-plane-only and must not be exposed through generic `/execute` or capability discovery.
7. All cross-service calls require service identity and must be auditable; shared static secrets are transitional only.
8. Vercel remains a deployment target, not the architectural control plane.

## Current findings

### Confirmed capability lineage

- `AgentFusion-Foundary` contains a production-oriented multi-tenant agent operating system with runtime, policy, billing, eventing, IAM, audit, marketplace, and Cloud Run/Kubernetes/Docker assets.
- `HOARE-AGENT` contains the formal verification/proof pipeline, SDKs, GitHub Action proof gate, API-key tenant metering, Stripe billing, tenant-scoped schema registry, and audit visibility.
- `hoare-ai` contains the modular agent runtime, workflow engine, capability registry, QGPS SDK, security middleware, observability, and Vercel deployment path.
- `Auto-Dev-Engine`, `agentic-devops-mvp`, `UACO`, and related AutoDev repositories represent earlier agentic DevOps/platform iterations and should be mined for capabilities rather than duplicated.

### Gaps requiring implementation or verification

- The TechFusion GitHub importer currently uses a server-side `GITHUB_IMPORT_TOKEN`. Production should use the tenant/user's authorized GitHub App installation or OAuth flow with repository access, while retaining the server-side token only as a controlled development fallback.
- The AgentFusion GitHub OAuth router currently requests only `read:user`; this is insufficient by itself for repository import. The production GitHub App/installation flow must grant the minimum repository permissions required for import and webhooks.
- PASOR has no canonical repository identity confirmed in the connected GitHub repositories. Do not bind an unrelated repository by name.
- AEGIS/AEGISC has no canonical repository identity confirmed in the connected GitHub repositories. Do not bind an unrelated repository by name.
- `hoare-ai` has a generic authenticated `/api/execute` route that dispatches directly to registered tools. The route must remain behind capability/entitlement authorization and must explicitly deny private control-plane capabilities to tenant/service callers.
- The current in-memory rate limiter in `hoare-ai` is not sufficient for distributed production deployment; use a shared limiter when horizontally scaled.

## Required governed lifecycle

```text
Tenant
  -> Subscription / Entitlement
  -> GitHub authorization
  -> Repository import
  -> Exact commit SHA
  -> PASOR build/modify
  -> AEGIS/AEGISC verification
  -> HOARE capability/policy authorization
  -> QGPS/resource governance
  -> Deployment Fabric
  -> Vercel / Cloudflare / GCP / future HOARE-native target
  -> Audit + usage metering
```

## Non-goals

- Do not merge older repositories into `tech-fusion-grid-ui` wholesale.
- Do not duplicate QGPS, AgentFusion, HOARE-Agent, PASOR, or AEGIS implementations.
- Do not expose private HOARE knowledge through public APIs.
- Do not replace the existing Vercel configuration; only add provider abstraction around it.

## Merge gate

This branch is not production-ready until the following are verified:

1. GitHub App/installation repository import works with tenant binding.
2. Stripe webhook maps the subscription/customer to the existing HOARE tenant.
3. PASOR canonical implementation and API are identified.
4. AEGIS/AEGISC canonical implementation and API are identified.
5. Service-to-service authentication includes identity, expiry/replay protection, and audit correlation.
6. Capability entitlement is enforced before any execution tool is invoked.
7. Private control-plane capabilities are excluded from tenant capability discovery and invocation.
8. Migration, typecheck, tests, and CI pass.
9. Existing Vercel deployment behavior remains unchanged.
