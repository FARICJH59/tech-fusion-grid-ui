# AGENT_SECURITY_MODEL.md

**Phase 9A.7 — Agent Security and Governance Model**
_Tech Fusion Grid + HOARE.ai AgentFusion Platform_
_Generated: 2026-07-11 | Status: Analysis Only — No Production Code Modified_

---

## Overview

This document analyzes the existing security model and its compatibility with the AgentFusion Agentic Development Platform requirements. It covers tenant isolation, RBAC, ABAC, policy engines, audit logging, secret management, approval workflows, and compliance requirements.

---

## 1. Tenant Isolation

### Current Implementation

| Mechanism | Location | Enforcement Point |
|---|---|---|
| JWT `tenantId` claim | `lib/auth.ts` (`TokenPayload`) | Every authenticated API request |
| `EnterpriseSecurity.isAuthorized()` | `lib/enterprise/security.ts` | `tenantId === resourceTenantId` strict check |
| Supabase RLS policies | `migrations/` | Database row-level isolation |
| `TenantVault` | `lib/security/tenant-vault.ts` | Per-tenant secret storage and access |
| MQTT tenant ACLs | `lib/enterprise/messaging.ts` (`TenantAclRule`) | Per-tenant topic read/write access |
| Fleet placement | `lib/enterprise/fleet.ts` | Per-tenant workload region assignment |
| Event bus scoping | `lib/events/event-bus.ts` | `tenantId` + `organizationId` required on every event |

### Compatibility with AgentFusion

**Compatible as-is:**
- JWT-based tenant isolation propagates to all agent API routes
- Supabase RLS will enforce tenant isolation on new `agentfusion_*` tables (add RLS policies in each migration)
- `AutonomousEventBus` already scopes by `tenantId` and `organizationId`

**Gaps requiring Phase 9B work:**
- Agent-to-agent calls must carry caller's `tenantId` in request context
- Cross-tenant agent composition requires explicit cross-tenant permission grants (new concept)
- Marketplace-installed third-party agents must be sandboxed in tenant context

**Recommendation:** Add `tenantId` enforcement as the first check in the Agent Runtime execution pipeline before any tool call or API access.

---

## 2. Role-Based Access Control (RBAC)

### Current Role Hierarchy

```
service (4) — highest: automated service accounts
    │
admin (3) — full control within tenant
    │
operator (2) — operational actions, no billing/user mgmt
    │
viewer (1) — read-only access
```

Implementation: `lib/auth.ts` (`ROLE_HIERARCHY`, `hasMinRole()`, `requireRole()`)

### RBAC Compatibility with AgentFusion

| AgentFusion Action | Required Role | Existing Check |
|---|---|---|
| Create agent template | operator+ | `withAuth` + `requireRole('operator')` |
| Deploy agent | operator+ | `withAuth` + `requireRole('operator')` |
| Run agent workflow | viewer+ | Available to all authenticated users |
| Access TenantVault secrets | operator+ | `accessPolicyRegistry.isAllowed()` |
| Modify agent lifecycle (pause/retire) | admin+ | `requireRole('admin')` |
| Cloud Run tool execution | operator+ | `AutonomousPolicyEngine` + role check |
| Marketplace publish | admin+ | Publisher verification gate |
| Cross-tenant agent grant | admin+ | New: requires explicit cross-tenant grant |

**Recommendation:** The existing role hierarchy is sufficient for AgentFusion. No new roles needed for Phases 9B–9E. Phase 9G (healthcare/finance) may require a `compliance-officer` role — evaluate then.

---

## 3. Attribute-Based Access Control (ABAC)

### Current Implementation

`EnterpriseSecurity.isAuthorized()` evaluates:
1. RBAC: actor role ≥ required role
2. Tenant isolation: `tenantId === resourceTenantId`
3. ABAC scope: `attributes.scope` must be in `{read, write, admin}`

### ABAC Compatibility with AgentFusion

**Current ABAC is minimal (single `scope` attribute).** For AgentFusion, ABAC needs to be extended to cover:

| Attribute | Purpose | Phase |
|---|---|---|
| `agent.tools` | Which tools an agent is permitted to call | 9C |
| `agent.connectors` | Which external connectors an agent can use | 9E |
| `agent.memory.scope` | Read-only vs read-write memory access | 9B |
| `agent.ai.providers` | Which AI providers an agent may use | 9C |
| `agent.industry` | Which industry verticals an agent can access | 9F/9G |
| `workflow.maxCostUsd` | Budget ceiling per workflow run | 9C |

**Recommendation:** Extend `EnterpriseSecurity.isAuthorized()` in Phase 9C to accept additional attribute keys. The existing `attributes: Record<string, string>` parameter is already the correct interface.

---

## 4. Policy Engine

### Dual-Policy Architecture (Current)

| Engine | Location | Purpose | Storage |
|---|---|---|---|
| `AutonomousPolicyEngine` | `lib/policy/engine.ts` | Runtime risk-score cloud actions; auto-approve/escalate/reject | In-process (decisions list) |
| `PolicyEngine` | `lib/enterprise/policy-engine.ts` | Tenant policy records (tenant/deployment/runtime/remediation types) | Supabase `phase7_policies` |

### Policy Rules (`lib/policy/rules.ts`)

Default rules loaded by `AutonomousPolicyEngine`:
- Rules exist for action types: `deploy`, `traffic-migration`, `scale`, `rollback`, `remediate`
- Each rule has: `maxRiskLevel`, `allowAutoApprove`, `budgetGuardEnabled`, `requireTenantIsolation`

### Risk Scoring (`lib/policy/risk-scoring.ts`)

Risk levels: `low < medium < high < critical`

Scored based on:
- Declared `riskLevel` on action
- Content of `reason` field (keyword analysis)

### AgentFusion Policy Requirements

| New Policy Type | Description | Phase |
|---|---|---|
| `agent-execution` | Govern agent run requests | 9B |
| `agent-tool-call` | Govern which tools an agent may call | 9C |
| `agent-memory` | Govern cross-agent memory access | 9B |
| `agent-connector` | Govern external connector usage | 9E |
| `marketplace-install` | Govern which agents a tenant may install | 9H |

**Recommendation (Phase 9C):** Add new `PolicyRule.action` values for agent-specific actions. The `AutonomousPolicyEngine` is already generic over action types.

### Emergency Controls

`lib/policy/emergency-controls.ts` provides emergency circuit breakers:
- Operator override for any autonomous action
- Emergency stop propagated via `AutonomousEventBus`

**Compatibility:** Agent workflows must subscribe to emergency stop events and halt execution. Add this subscription in Phase 9B Agent Runtime.

---

## 5. Audit Logging

### Current Audit Sources

| Source | Storage | Access |
|---|---|---|
| API audit trail | Supabase `phase7_audit_logs` | `GET /api/audit` |
| Cloud action trail | `CloudRunController.auditTrail[]` (in-process) | `CloudRunController.listAuditTrail()` |
| `TenantVault` access | `TenantVault.audit[]` (in-process) | `TenantVault.listAudit()` |
| `AutonomousPolicyEngine` decisions | `PolicyDecision[]` (in-process) | `AutonomousPolicyEngine.listDecisions()` |
| Postmortems | `lib/incidents/postmortem.ts` | Internal |
| OTel traces | Jaeger / GCP Cloud Logging | Distributed tracing |

### Audit Gap Analysis

| Event | Current Audit | Gap |
|---|---|---|
| Agent created | ❌ | Add to Phase 9B |
| Agent workflow started | ❌ | Add to Phase 9B |
| Agent tool call | ❌ | Add to Phase 9C |
| Agent memory read/write | ❌ | Add to Phase 9B |
| Agent policy decision | Partial (policy decisions in-process only) | Persist to Supabase in Phase 9C |
| Connector credential accessed | ✅ `TenantVault.listAudit()` | Persist to Supabase in Phase 9E |
| Marketplace install | ❌ | Add to Phase 9H |

**Recommendation:** Add `agentfusion_audit_log` Supabase table in Phase 9B migration. All agent operations emit structured audit records. Use `AutonomousEventBus` to fan-out audit events.

---

## 6. Secret Management

### Current Architecture

```
TenantVault (lib/security/tenant-vault.ts)
    │  RBAC-gated access, audit trail
    ▼
EnterpriseSecretManager (lib/security/secret-manager.ts)
    │  Multi-vault abstraction
    ├──► GCP Secret Manager  (@google-cloud/secret-manager)
    ├──► Vault-compatible    (HashiCorp Vault interface)
    ├──► AWS Secrets Manager (AWS SDK interface)
    └──► Azure Key Vault     (Azure SDK interface)
```

**Authentication:** Workload Identity Federation (WIF) — no long-lived service account keys. Enforced by `assertNoLongLivedKeys()` at startup.

**Credential Rotation:** `lib/security/credential-rotation.ts` — automatic rotation with version tracking.

### AgentFusion Secret Requirements

| Secret Type | Storage | Access Pattern |
|---|---|---|
| Connector API keys (GitHub, Stripe, etc.) | `TenantVault` → GCP Secret Manager | Agent runtime reads on workflow start |
| AI provider API keys | `TenantVault` | Per-tenant, rotated every 24h |
| Agent signing keys (JWT for inter-agent calls) | `TenantVault` | Generated per agent, rotated on lifecycle change |
| Industry vertical data encryption keys | `TenantVault` → GCP Secret Manager | At-rest encryption for sensitive verticals |

**Compatibility:** `TenantVault` is the correct interface for all agent secret access. The multi-vault abstraction already supports the required providers.

**New requirement for Phase 9C:** Agent Runtime must call `TenantVault.getSecret()` for any connector credential, never read environment variables directly. This ensures audit trail and rotation support.

---

## 7. Approval Workflows

### Current Implementation

**`ApprovalFlow`** (`lib/policy/approval-flow.ts`):
- States: `pending`, `approved`, `rejected`
- Created by `AutonomousPolicyEngine` when `allowAutoApprove = false`
- Supports delegation via `lib/policy/approval-delegation.ts`
- Emergency bypass via `lib/policy/emergency-controls.ts`

**`AutonomousPolicyEngine.evaluate()`** (`lib/policy/engine.ts`):
- Decision outcomes: `approve` (auto), `escalate` (manual approval required), `reject`
- Approval stored in `ApprovalFlow`; result returned to calling orchestrator

### AgentFusion Approval Integration

| AgentFusion Action | Approval Required | Who Approves |
|---|---|---|
| High-risk agent deployment | Yes (auto-reject if critical risk) | Tenant admin |
| Cloud Run tool call from agent | Yes (risk ≥ medium) | Operator |
| Cross-tenant data access | Always | Admin of both tenants |
| Budget override request | Always | Admin |
| Marketplace listing approval | Yes | Platform reviewer (admin) |
| Emergency agent stop | No (immediate) | Any operator |

**Compatibility:** `ApprovalFlow` is the correct mechanism. Phase 9B Agent Runtime must:
1. Call `AutonomousPolicyEngine.evaluate()` before any agent-initiated cloud action
2. Pause workflow if decision is `escalate`
3. Resume workflow when approval is granted
4. Emit `AutonomousEvent` of type `approval` on resolution

---

## 8. Compliance Requirements

### Current Compliance Posture

| Requirement | Status | Evidence |
|---|---|---|
| Tenant data isolation | ✅ | Supabase RLS + `EnterpriseSecurity.isAuthorized()` |
| Authentication logging | ✅ | `phase7_audit_logs` table + OTel traces |
| Secret rotation | ✅ | `credential-rotation.ts` |
| No long-lived credentials | ✅ | `assertNoLongLivedKeys()` enforcement |
| TLS in transit | ✅ | EMQX mTLS, Cloud Run HTTPS, GCP API TLS |
| Input validation | ✅ | Zod schemas on all API routes |
| Rate limiting | ✅ | Redis-backed sliding window |
| CodeQL static analysis | ✅ | `ci.yml` → CodeQL workflow |
| Dependency audit | ✅ | `npm audit --audit-level=high` in CI |

### Industry-Specific Compliance (Phase 9G)

| Industry | Regulation | Gap | Phase |
|---|---|---|---|
| Healthcare | HIPAA | No PHI handling controls | 9G |
| Finance | PCI DSS | No cardholder data isolation | 9G |
| Finance | SOC 2 Type II | No formal controls evidence | 9G |
| Education | FERPA | No student PII controls | 9G |
| General (EU tenants) | GDPR | Data residency not enforced | 9F/9G |
| General | SOC 2 Type I | Partially addressed | Ongoing |

**Recommendation:** Each regulated vertical (healthcare, finance) must be developed with a compliance engineer. Do not deploy Phase 9G verticals for regulated industries without formal compliance review.

---

## 9. Governance Summary

### What to Keep (Phase 9B+)

| Component | Keep Because |
|---|---|
| JWT + RBAC (`lib/auth.ts`) | Already correct; all agent APIs will use it |
| `EnterpriseSecurity.isAuthorized()` | RBAC + ABAC + tenant isolation in one call |
| `AutonomousPolicyEngine` | Generic over action type; extensible for agent actions |
| `TenantVault` | Correct abstraction for multi-vault secrets |
| `ApprovalFlow` | Already supports pause/resume for human-in-the-loop |
| Supabase RLS | Must be applied to every new `agentfusion_*` table |
| WIF authentication | No long-lived keys — keep as hard requirement |
| OTel tracing | Must be extended to cover agent execution spans |

### What to Extend (Phase 9C)

| Component | Extension Needed |
|---|---|
| `EnterpriseSecurity` ABAC | Add agent-specific attribute keys |
| `AutonomousPolicyEngine` rules | Add agent-execution, agent-tool-call rule types |
| `PolicyEngine` policy types | Add `agent-execution`, `agent-connector` types |
| Audit logging | Persist all agent events to Supabase |
| `ApprovalFlow` | Add async callback for workflow resume on approval |

### What to Add (Phase 9B)

| Component | Reason |
|---|---|
| `agentfusion_audit_log` Supabase table | Persistent agent action audit trail |
| Agent execution span in OTel | Distributed trace for agent workflow runs |
| Per-agent budget cap enforcement | Prevent cost runaway |
| Emergency stop event subscription in Agent Runtime | Respect operator controls |

---

## Security Review Conclusion

The existing security model is **well-architected and compatible** with the AgentFusion evolution. No existing security component needs to be replaced. The primary work is:

1. **Extending policy rules** to cover agent-specific action types
2. **Persisting audit records** currently held only in-process
3. **Adding ABAC attributes** for fine-grained agent permissions
4. **Enforcing RLS** on all new database tables from Phase 9B onward
5. **Compliance review** for regulated industry verticals before Phase 9G deployment

---

_This document was produced as part of Phase 9A analysis. No production code was modified._
