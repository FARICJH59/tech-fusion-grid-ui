# AGENTIC_MIGRATION_ROADMAP.md

**Phase 9A.6 — Agentic Migration Roadmap**
_Tech Fusion Grid + HOARE.ai → AgentFusion Platform_
_Generated: 2026-07-11 | Status: Analysis Only — No Production Code Modified_

---

## Guiding Principles

1. **No breaking changes** — every phase preserves all existing APIs, deployments, and tests
2. **Incremental exposure** — internal capabilities are promoted to public APIs one layer at a time
3. **Test-first** — each phase adds validation before implementation
4. **Rollback by default** — all migrations use feature flags or additive changes only
5. **Security continuity** — Phase 8 security model extended, never replaced

---

## Phase 9B — Agent SDK Foundation

### Objectives

- Persist the `EnterpriseAgentFramework` state to Supabase (currently in-process only)
- Expose an Agent Registry API (`/api/agents`)
- Create a public-facing TypeScript Agent SDK (REST + WebSocket)
- Establish persistent memory via Redis (short-term) and Supabase (long-term)
- Audit and archive legacy root-level scripts

### Files Affected

| File / Path | Action |
|---|---|
| `migrations/006_phase9b_agent_foundation.sql` | Add: `agentfusion_agents`, `agentfusion_templates`, `agentfusion_workflows`, `agentfusion_memory` tables |
| `app/api/agents/route.ts` | Add: `GET /api/agents` (list), `POST /api/agents` (create) |
| `app/api/agents/[id]/route.ts` | Add: `GET`, `PATCH`, `DELETE` per-agent |
| `app/api/agents/[id]/run/route.ts` | Add: `POST /api/agents/:id/run` — start workflow |
| `lib/enterprise/agents.ts` | Adapt: add Supabase persistence layer, keep in-process fallback |
| `lib/agentfusion/memory.ts` | Add: persistent memory module (Redis + Supabase) |
| `lib/agentfusion/sdk/client.ts` | Add: TypeScript SDK client wrapper |
| `legacy/` | Add: move root-level scripts (`server.js`, `harvester.js`, etc.) |

### Dependencies

- Phase 8 infrastructure (existing — no changes required)
- Supabase migration `005_phase9_account_billing_foundation.sql` (complete)
- Redis available (`REDIS_URL` env var)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Supabase migration failure | Low | Run migration in dev first; use `IF NOT EXISTS` guards |
| Breaking existing agent tests | Medium | New tables are additive; `lib/enterprise/agents.ts` changes behind feature flag |
| In-process → persistent memory data loss | Low | No production data in current in-process store |

### Rollback Strategy

- All new files are additive — no existing files deleted
- Feature flag: `AGENTFUSION_PERSIST_AGENTS=true` env var to enable Supabase persistence
- If rollback needed: unset env var, in-process behavior restored

### Validation Criteria

- `npm run lint && npm run typecheck && npm run test` pass
- `GET /api/agents` returns 200 with empty array when no agents registered
- Agent created via `POST /api/agents` survives process restart (when persistence enabled)
- All 91 existing tests continue passing

---

## Phase 9C — AgentFusion Framework

### Objectives

- Implement Workflow Orchestrator as DAG (parallel branches, sub-agent calls)
- Implement Tool Execution Runtime (wire `AgentTemplate.tools` to actual calls)
- Implement Evaluation Framework (scoring, A/B routing, human feedback)
- Add composite `AgentPolicyEnforcer` unifying both policy engines
- Add per-agent permission scopes

### Files Affected

| File / Path | Action |
|---|---|
| `migrations/007_phase9c_agentfusion_framework.sql` | Add: `agentfusion_evaluations`, `agentfusion_tool_calls`, `agentfusion_policy_scopes` tables |
| `lib/agentfusion/orchestrator.ts` | Add: DAG workflow engine (extends `EnterpriseAgentFramework`) |
| `lib/agentfusion/tool-runtime.ts` | Add: Tool dispatcher (connects to `IntegrationLayer`) |
| `lib/agentfusion/evaluation.ts` | Add: Evaluation framework (accuracy, latency, cost) |
| `lib/agentfusion/policy.ts` | Add: `AgentPolicyEnforcer` (consults both policy engines) |
| `app/api/agents/[id]/evaluate/route.ts` | Add: feedback endpoint |
| `app/platform/evaluations/page.tsx` | Add: evaluation dashboard |

### Dependencies

- Phase 9B (Agent SDK Foundation) — agent persistence must be in place
- `lib/policy/engine.ts` and `lib/enterprise/policy-engine.ts` (existing — no changes)
- `lib/enterprise/integrations.ts` (existing — used as tool connector registry)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| DAG orchestrator complexity | High | Start with sequential + fan-out only; add full DAG in Phase 9C.2 |
| Tool execution sandboxing | Medium | Enforce per-tenant timeouts and resource limits from entitlements |
| Evaluation database growth | Medium | Add TTL policy; archive old evaluations via background job |

### Rollback Strategy

- All new modules in `lib/agentfusion/` — no changes to existing `lib/enterprise/` files
- DAG orchestrator is opt-in: `EnterpriseAgentFramework.startWorkflow()` unchanged
- Evaluation is purely additive

### Validation Criteria

- Tool calls are executed and results stored in `agentfusion_tool_calls`
- Workflow with parallel branches completes correctly
- Evaluation scores are recorded and queryable
- Policy enforcer correctly gates agent-initiated actions
- All prior tests pass

---

## Phase 9D — HOARE-Agent Integration

### Objectives

- Bridge MQTT IoT events to agent workflow triggers
- Add knowledge retrieval (vector search via pgvector)
- Implement persistent cross-agent memory with semantic search
- Connect `GcpCloudClient` as an agent-callable tool
- Add HOARE-Agent as a named agent type in the registry

### Files Affected

| File / Path | Action |
|---|---|
| `migrations/008_phase9d_hoare_agent.sql` | Add: `pgvector` extension, `agentfusion_knowledge_embeddings` table |
| `lib/agentfusion/mqtt-bridge.ts` | Add: MQTT topic → agent workflow trigger |
| `lib/agentfusion/knowledge.ts` | Add: Vector-based knowledge retrieval |
| `lib/agentfusion/hoare-agent.ts` | Add: HOARE-Agent definition (extends `EnterpriseAgentFramework`) |
| `lib/agentfusion/tools/cloud-run-tool.ts` | Add: Cloud Run as agent tool (wraps `CloudRunController`) |
| `app/api/agents/knowledge/route.ts` | Add: Knowledge ingestion API |

### Dependencies

- Phase 9B + 9C complete
- Supabase `pgvector` extension (requires Supabase project to enable)
- Existing `lib/mqtt.ts` and `lib/enterprise/messaging.ts`
- Existing `lib/cloud/cloud-run-controller.ts`

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| pgvector not available in Supabase tier | Medium | Fall back to Supabase full-text search if pgvector unavailable |
| MQTT bridge event storm | Medium | Rate limit MQTT → agent triggers per tenant |
| Cloud Run tool misuse | High | All cloud actions still gated by `AutonomousPolicyEngine` |

### Rollback Strategy

- `lib/agentfusion/mqtt-bridge.ts` is not started unless `HOARE_AGENT_MQTT_BRIDGE=true`
- Cloud Run tool requires `admin` or `operator` role
- pgvector migration is additive (new table only)

### Validation Criteria

- MQTT message triggers agent workflow execution end-to-end
- Knowledge embeddings are created and semantically retrieved
- Cloud Run tool executes with policy gate active
- HOARE-Agent definition appears in agent registry

---

## Phase 9E — Connector Framework

### Objectives

- Implement all 10 stub enterprise connectors with real API integrations
- Add connector health monitoring and retry policies
- Build connector configuration API (per-tenant, encrypted secrets via TenantVault)
- Add rate limiting per connector per tenant

### Files Affected

| File / Path | Action |
|---|---|
| `lib/agentfusion/connectors/github.ts` | Add: Real GitHub REST API client |
| `lib/agentfusion/connectors/google-workspace.ts` | Add: Google Workspace API client |
| `lib/agentfusion/connectors/microsoft-365.ts` | Add: MS Graph API client |
| `lib/agentfusion/connectors/stripe.ts` | Add: Stripe webhook handler + billing API |
| `lib/agentfusion/connectors/jira.ts` | Add: Jira REST API client |
| `lib/agentfusion/connectors/servicenow.ts` | Add: ServiceNow API client |
| `lib/agentfusion/connectors/salesforce.ts` | Add: Salesforce REST API client |
| `lib/agentfusion/connectors/datadog.ts` | Add: Datadog metrics push |
| `lib/agentfusion/connectors/grafana.ts` | Add: Grafana webhook handler |
| `lib/agentfusion/connectors/github-copilot.ts` | Add: GitHub Copilot API integration |
| `migrations/009_phase9e_connector_config.sql` | Add: `agentfusion_connector_configs` table |
| `app/api/connectors/route.ts` | Add: Connector management API |

### Dependencies

- Phase 9B–9D complete
- `lib/security/tenant-vault.ts` (existing) — connector credentials stored here
- `lib/enterprise/integrations.ts` (existing `IntegrationPlugin` interface — keep)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Third-party API credential management | High | All credentials through `TenantVault` — never stored in plain text |
| Connector API rate limits | Medium | Per-connector rate limiter using existing Redis rate limit infrastructure |
| Breaking existing stub tests | Low | Real implementations replace stubs; test suite updated |

### Rollback Strategy

- Each connector is independently registered; failing connector does not affect others
- Stubs in `lib/enterprise/integrations.ts` remain as fallback if new implementations disabled
- Feature flag: `CONNECTOR_{NAME}_ENABLED=true` per connector

### Validation Criteria

- GitHub connector: can list repositories for authenticated tenant
- Stripe connector: webhook received and processed
- All connectors return structured errors on failure (not crashes)
- `TenantVault` audit shows all connector secret accesses

---

## Phase 9F — HOARE StyleAI Vertical

### Objectives

- Implement the fashion industry plugin (`/agents/fashion`)
- StyleAI agent templates: outfit recommendation, trend analysis, inventory management
- Fashion knowledge base (product embeddings, style rules)
- StyleAI UI within HOARE.ai experience layer
- Fashion-specific compliance profile (GDPR for personal style data)

### Files Affected

| File / Path | Action |
|---|---|
| `lib/agentfusion/industries/fashion/templates.ts` | Add: StyleAI agent templates |
| `lib/agentfusion/industries/fashion/tools.ts` | Add: Style analysis, inventory, trend tools |
| `lib/agentfusion/industries/fashion/knowledge.ts` | Add: Fashion knowledge sources |
| `lib/agentfusion/industries/fashion/compliance.ts` | Add: GDPR + fashion data policies |
| `app/agents/fashion/` | Add: Fashion agent management pages |
| `migrations/010_phase9f_fashion_vertical.sql` | Add: Fashion-specific tables |

### Dependencies

- Phase 9D complete (knowledge retrieval via pgvector required)
- Phase 9E complete (product/inventory connectors)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Fashion data quality (training/knowledge) | High | Start with curated seed knowledge base; improve iteratively |
| GDPR compliance for style preferences | Medium | Privacy-by-design: no PII in embeddings; consent management |

### Rollback Strategy

- Industry plugins are self-contained modules; removing fashion plugin does not affect platform
- Industry pack installed/uninstalled via `MarketplaceRegistry.register()` / future deregister API

### Validation Criteria

- StyleAI agent can recommend outfits given style preferences
- Knowledge retrieval returns relevant fashion results
- GDPR consent check gate is active
- Fashion pack appears in marketplace with correct metadata

---

## Phase 9G — Cross-Industry Plugins

### Objectives

- Implement remaining 7 industry verticals (beauty, healthcare, education, finance, manufacturing, iot, enterprise)
- Each with domain templates, tools, knowledge sources, compliance profiles
- Cross-vertical agent composition (agents from different industries can collaborate)

### Files Affected

```
lib/agentfusion/industries/
  beauty/       healthcare/     education/
  finance/      manufacturing/  iot/
  enterprise/
app/agents/
  beauty/       healthcare/     education/
  finance/      manufacturing/  iot/
  enterprise/
migrations/011_phase9g_industry_verticals.sql
```

### Dependencies

- Phase 9F complete (fashion vertical as reference implementation)
- Phase 9D complete (HOARE-Agent + MQTT bridge — required for IoT vertical)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Healthcare regulatory compliance (HIPAA) | High | Healthcare vertical requires HIPAA-compliant data handling; separate Supabase schema |
| Finance regulatory compliance (SOC 2, PCI DSS) | High | Finance vertical requires PCI DSS connector isolation; dedicated vault |
| IoT vertical MQTT storm under high device load | Medium | IoT agent bridge has per-tenant event rate limiting (Phase 9D) |

### Rollback Strategy

- Each industry vertical is independently deployable
- Vertical disabled via `MarketplaceRegistry` deregistration
- No shared state between verticals

### Validation Criteria

- All 8 industry verticals have at least 1 working agent template
- Cross-vertical composition: healthcare agent can call finance agent for billing
- IoT vertical responds to MQTT events within 500ms p95
- All compliance profiles active and tested

---

## Phase 9H — Agent Marketplace

### Objectives

- Build the full Agent Marketplace UI and API
- Enable third-party agent/tool/workflow publishing
- Implement marketplace billing (Stripe integration from Phase 9E)
- Add agent versioning and dependency management
- Publisher verification and review workflow

### Files Affected

| File / Path | Action |
|---|---|
| `app/marketplace/` | Add: Marketplace browser, publisher portal |
| `app/api/marketplace/route.ts` | Add: Marketplace listing, install, uninstall API |
| `app/api/marketplace/publish/route.ts` | Add: Publisher submission API |
| `lib/agentfusion/marketplace-manager.ts` | Add: Publishing workflow, review, billing |
| `migrations/012_phase9h_marketplace.sql` | Add: `marketplace_listings`, `marketplace_installs`, `marketplace_reviews` |

### Dependencies

- Phase 9B–9G complete (all industry verticals as first-party listings)
- Phase 9E complete (Stripe connector for marketplace billing)
- `lib/enterprise/marketplace.ts` (existing `MarketplaceRegistry` — adapt)

### Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Malicious third-party agents | High | Sandboxed execution, code review requirement, publisher verification |
| Marketplace billing complexity | Medium | Start with free listings only; add paid listings in Phase 9H.2 |
| Version conflicts between agent dependencies | Medium | Semantic versioning + compatibility matrix |

### Rollback Strategy

- Marketplace is additive layer on top of existing `MarketplaceRegistry`
- Third-party listings can be individually disabled
- Billing can be disabled: `MARKETPLACE_BILLING_ENABLED=false`

### Validation Criteria

- First-party industry packs appear in marketplace
- Third-party agent can be submitted, reviewed, approved, and installed
- Installed agent functions identically to first-party agents
- Marketplace billing tracks usage and bills via Stripe

---

## Dependency Graph

```
Phase 9B (Agent SDK Foundation)
    │
    ▼
Phase 9C (AgentFusion Framework)
    │
    ▼
Phase 9D (HOARE-Agent Integration)
    │
    ├──► Phase 9E (Connector Framework) ──────────────┐
    │                                                 │
    └──► Phase 9F (HOARE StyleAI Vertical)            │
              │                                       │
              ▼                                       ▼
         Phase 9G (Cross-Industry Plugins) ──► Phase 9H (Agent Marketplace)
```

---

## Cross-Phase Risks

| Risk | Phases Affected | Mitigation |
|---|---|---|
| Supabase schema migrations fail in production | 9B–9H | All migrations tested in dev; use `BEGIN/COMMIT`; have rollback SQL |
| Redis memory exhaustion from agent memory | 9B+ | Per-tenant Redis memory quotas; TTL on all agent memory keys |
| JWT token scope not sufficient for agents | 9B+ | Add `agentId` claim to token payload in Phase 9B |
| Cost explosion from AI provider usage | 9C+ | Cost optimization engine already present; add per-agent budget caps |
| Multi-region consistency for agent state | 9D+ | Use Supabase as source of truth; Redis as cache with invalidation |

---

_This document was produced as part of Phase 9A analysis. No production code was modified._
