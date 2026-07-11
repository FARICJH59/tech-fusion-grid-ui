# AGENTFUSION_TARGET_ARCHITECTURE.md

**Phase 9A.5 — AgentFusion Target Architecture**
_Tech Fusion Grid + HOARE.ai Enterprise Agentic Platform_
_Generated: 2026-07-11 | Status: Analysis Only — No Production Code Modified_

---

## Vision

AgentFusion is a modular, multi-tenant, cross-industry Agentic Development Platform built on top of the existing Tech Fusion Grid + HOARE.ai infrastructure. It exposes the current internal agent capabilities as a public platform, adds an evaluation framework, extends to industry verticals, and provides a marketplace for sharing agents, tools, and workflows.

---

## Architecture Diagram (ASCII)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          EXPERIENCE LAYER                                       │
│                                                                                 │
│   Tech Fusion Grid UI          │         HOARE.ai Application                  │
│   (Next.js 15 App Router)      │         (Agent Management, StyleAI, etc.)     │
│                                │                                                │
│   Dashboard  │  Telemetry  │  Audit  │  Platform  │  Operations  │  Billing    │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │  REST / WebSocket / SSE / MQTT
┌─────────────────────────────▼───────────────────────────────────────────────────┐
│                       AGENT INTELLIGENCE LAYER                                  │
│                                                                                 │
│   HOARE-Agent Core          Agent SDK                  Agent Runtime            │
│   ─────────────────         ─────────────────          ─────────────────        │
│   • Template registry       • TypeScript SDK           • Execution engine       │
│   • Lifecycle manager       • Python SDK               • Streaming support      │
│   • Workflow orchestrator   • REST API                 • Tool dispatcher        │
│   • Memory system           • WebSocket API            • Error recovery         │
│   • Approval gateway        • MQTT API                 • Rate limiting          │
│   • Versioning              • Webhook API              • Tenant isolation       │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────────────┐
│                      AGENTFUSION FRAMEWORK LAYER                                │
│                                                                                 │
│  Agent Registry     │  Agent Lifecycle  │  Workflow Orchestrator                │
│  ──────────────     │  Manager          │  ──────────────────────               │
│  • register()       │  ──────────────── │  • startWorkflow()                    │
│  • discover()       │  • draft          │  • appendEvent()                      │
│  • list() API       │  • active         │  • await approval                     │
│  • version mgmt     │  • paused         │  • parallel branches                  │
│                     │  • retired        │  • sub-agent calls                    │
│                                                                                 │
│  Memory System      │  Permission Layer │  Evaluation Framework                 │
│  ──────────────     │  ──────────────── │  ──────────────────────               │
│  • Key-value store  │  • RBAC           │  • Accuracy scoring                   │
│  • Redis-backed     │  • ABAC           │  • Latency tracking                   │
│  • Cross-agent      │  • Tenant isol.   │  • Cost efficiency                    │
│  • TTL / eviction   │  • Policy engine  │  • Human feedback loop                │
│  • Semantic search  │  • Budget guard   │  • A/B routing                        │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────────────┐
│                       INTEGRATION LAYER                                         │
│                                                                                 │
│  AI Provider Gateway       Tool Connectors          Industry Plugins            │
│  ──────────────────        ───────────────          ────────────────            │
│  • Google Gemini           • GitHub                 • Fashion (StyleAI)         │
│  • OpenAI                  • Google Workspace       • Beauty                    │
│  • Anthropic               • Microsoft 365          • Healthcare                │
│  • Multi-provider routing  • Stripe                 • Education                 │
│  • Streaming               • Jira / ServiceNow      • Finance                   │
│  • Cost tracking           • Salesforce             • Manufacturing             │
│  • Retry / failover        • Datadog / Grafana      • IoT / Energy              │
│                                                     • Enterprise                │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────────────┐
│                        INDUSTRY LAYER (/agents)                                 │
│                                                                                 │
│  /agents/fashion      /agents/beauty       /agents/healthcare                  │
│  /agents/education    /agents/finance      /agents/manufacturing                │
│  /agents/iot          /agents/enterprise                                        │
│                                                                                 │
│  Each vertical:                                                                 │
│  • Domain-specific agent templates                                              │
│  • Specialized tools and knowledge sources                                      │
│  • Compliance/regulatory profiles                                               │
│  • Pre-built workflows                                                          │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────────────────────┐
│               INFRASTRUCTURE LAYER (Phase 8 Autonomous Cloud Control Plane)     │
│                                                                                 │
│  CloudRunController  │  DeploymentManager  │  RollbackEngine                   │
│  GcpCloudClient      │  ScalingEngine      │  RemediationLoop                  │
│  FleetManager        │  AutonomousPolicyEngine                                  │
│  SecretManager       │  TenantVault                                             │
│  AutonomousEventBus  │  Redis Streams                                           │
│  Supabase/PostgreSQL │  MQTT/EMQX                                               │
│  OTel + Jaeger       │  SLO Engine                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Layer Specifications

### Experience Layer

**Tech Fusion Grid UI** (existing — maintain)
- Next.js 15 App Router
- IoT dashboard, telemetry, audit, platform status, real-time operations SSE
- Add: Agent management pages, marketplace browser, evaluation dashboard

**HOARE.ai** (extend)
- HOARE StyleAI fashion vertical UI (Phase 9F)
- Cross-industry agent discovery (Phase 9G)
- Developer portal for SDK documentation

---

### Agent Intelligence Layer

#### HOARE-Agent Core

Built on existing `EnterpriseAgentFramework`. Additions needed:

| Addition | Phase | Description |
|---|---|---|
| Agent Registry API route | 9B | `GET/POST /api/agents` public API |
| Persistent agent store | 9B | Supabase migration for agent definitions |
| Cross-agent messaging | 9C | Agent-to-agent event routing via AutonomousEventBus |
| Tool execution runtime | 9C | Wire `AgentTemplate.tools` to actual tool calls |
| Knowledge retrieval | 9D | Vector store / Supabase full-text for `knowledgeSources` |

#### Agent SDK

Extends existing `EnterpriseSDKRegistry` (TypeScript + Python SDKs). Public-facing channels:

| Channel | Existing | Extension Needed |
|---|---|---|
| REST | `SDK_CHANNELS` includes REST | Implement SDK client |
| WebSocket | `SDK_CHANNELS` includes WebSocket | Real-time agent events |
| MQTT | `SDK_CHANNELS` includes MQTT | IoT device agent triggers |
| Webhooks | `SDK_CHANNELS` includes Webhooks | External trigger registration |

#### Agent Runtime

New execution engine wrapping `EnterpriseAgentFramework`:
- Sandboxed tool execution per agent
- Per-tenant resource quotas (from `resolveEntitlements()`)
- Streaming output (builds on AI provider streaming)
- Structured error recovery (builds on `withErrorHandler`)

---

### AgentFusion Framework Layer

#### Agent Registry

**Exists as:** `EnterpriseAgentFramework` (in-process Map)
**Target:** Supabase-persisted, API-exposed, multi-tenant

```
New table: agentfusion_agents
New table: agentfusion_templates
New table: agentfusion_workflows
API route: /api/agents (CRUD)
API route: /api/agents/:id/run
```

#### Agent Lifecycle Manager

**Exists as:** `EnterpriseAgentFramework.updateLifecycle()`
**Target:** State machine with transition validation, webhook notifications, audit trail

```
States: draft → active ↔ paused → retired
Transitions: emit AutonomousEvent on each change
Audit: write to phase7_audit_logs
```

#### Workflow Orchestrator

**Exists as:** `EnterpriseAgentFramework.startWorkflow()` (sequential events)
**Target:** DAG-based workflow with parallel branches, sub-agent calls, timeouts

```
Integrates with: AutonomousEventBus (existing)
Integrates with: ApprovalFlow (existing)
Adds: parallel step execution
Adds: sub-workflow composition
Adds: timeout/deadline enforcement
```

#### Memory System

**Exists as:** `WorkflowRun.memory` (in-process Map)
**Target:** Persistent, TTL-enabled, cross-agent shared, semantic search

```
Short-term: Redis HASH per workflow (TTL = workflow lifetime)
Long-term: Supabase table (agentfusion_memory)
Semantic: pgvector extension for embedding-based retrieval
```

#### Permission Layer

**Exists as:** `EnterpriseSecurity.isAuthorized()` + `AutonomousPolicyEngine`
**Target:** Composable per-agent permissions, scope-based tool access

```
Reuse: RBAC role hierarchy (lib/auth.ts)
Reuse: ABAC scope checks (lib/enterprise/security.ts)
Reuse: Budget guard (AutonomousPolicyEngine)
Add: Per-agent permission scope (tools, connectors, memory)
Add: Tenant entitlement enforcement (lib/enterprise/entitlements.ts)
```

#### Evaluation Framework

**Does not exist yet.**
**Target:**

```
Metrics: accuracy, latency p50/p95, cost per run, tool call success rate
Storage: agentfusion_evaluations Supabase table
A/B routing: AIProviderGateway preferred provider parameter (exists)
Human feedback: thumbs up/down API → evaluation record
Dashboard: /platform/evaluations page
```

---

### Integration Layer

#### AI Provider Gateway

**Exists as:** `AIProviderGateway` (lib/enterprise/providers.ts)
**Status: Keep as-is.** Already supports multi-provider, failover, streaming, cost tracking.

Minor additions for Phase 9D:
- Expose via Agent SDK (wrap `AIProviderGateway.execute()`)
- Add model alias routing for industry packs

#### Tool Connectors

**Exists as:** `IntegrationLayer` with 10 stub plugins (lib/enterprise/integrations.ts)
**Target:** Phase 9E full connector implementations

```
Interface: IntegrationPlugin (already correct — keep)
Add: Real GitHub API client
Add: Real Google Workspace client
Add: Real Stripe webhook handler
Add: Real Jira/ServiceNow client
Add: Real Salesforce connector
Add: Datadog/Grafana metric push
```

#### Industry Plugins

**Does not exist yet.**
**Target:** Pluggable industry packs extending `MarketplaceRegistry`

```
Marketplace extension type: "Industry Packs" (already declared)
Existing example: "Energy Grid Operations Pack" (registered in createDefaultMarketplace)
Target structure:

/agents
  /fashion      → HOARE StyleAI templates, tools, workflows
  /beauty       → Product recommendation, inventory agents
  /healthcare   → Scheduling, compliance, patient data agents
  /education    → Tutoring, assessment, content agents
  /finance      → Analysis, compliance, reporting agents
  /manufacturing → Quality control, supply chain agents
  /iot          → Device management, telemetry agents (leverage existing MQTT)
  /enterprise   → IT ops, HR, procurement agents
```

---

### Industry Layer

Structure for each vertical under `/agents/:industry/`:

```
/agents/:industry/
  ├── templates/     # Domain-specific AgentTemplate definitions
  ├── tools/         # Domain-specific tool connectors
  ├── workflows/     # Pre-built workflow definitions
  ├── knowledge/     # Domain knowledge sources
  └── compliance/    # Regulatory/compliance profiles
```

The **IoT vertical** has the strongest foundation:
- `lib/mqtt.ts` + production EMQX — real IoT connectivity
- `components/GridPipelineCanvas.tsx` — grid visualization
- `lib/enterprise/fleet.ts` — multi-region device placement

---

### Infrastructure Layer (Phase 8 — Maintain)

All Phase 8 components remain unchanged. AgentFusion builds on top of them:

| Component | AgentFusion Role |
|---|---|
| `CloudRunController` | Deploy agent runtime instances |
| `AutonomousPolicyEngine` | Gate agent-initiated cloud actions |
| `AutonomousEventBus` | Agent workflow event routing |
| `TenantVault` | Agent secret access |
| `EnterpriseSecurity` | Agent RBAC/ABAC checks |
| `FleetManager` | Agent runtime region placement |
| `AlertManager` | Agent failure notifications |
| `SLO Engine` | Agent performance SLOs |
| `OTel` | Agent execution tracing |

---

## Conflict and Duplication Analysis

### Duplicate Policy Engines

| System | Location | Scope |
|---|---|---|
| `AutonomousPolicyEngine` | `lib/policy/engine.ts` | Cloud action risk scoring, approval routing |
| `PolicyEngine` | `lib/enterprise/policy-engine.ts` | Supabase-persisted tenant/deployment/runtime policies |

**Recommendation:** KEEP both with clear ownership.
- `AutonomousPolicyEngine` → runtime decision (stateless, fast)
- `PolicyEngine` → policy record management (persistent, auditable)
- In Phase 9C, add a composite `AgentPolicyEnforcer` that consults both.

### Duplicate Orchestration Concerns

| System | Location | Overlap |
|---|---|---|
| `EnterpriseAgentFramework` | `lib/enterprise/agents.ts` | Workflow orchestration |
| `CloudRunController` | `lib/cloud/cloud-run-controller.ts` | Cloud deployment orchestration |
| `RemediationLoop` | `lib/cloud/remediation-loop.ts` | Self-healing orchestration |
| `ApprovalFlow` | `lib/policy/approval-flow.ts` | Approval workflow |

**Recommendation:** KEEP all — they operate at different abstraction levels. `EnterpriseAgentFramework` becomes the top-level orchestrator that may invoke the others as tools.

### Duplicate Secret Management

| System | Location | Scope |
|---|---|---|
| `EnterpriseSecretManager` | `lib/security/secret-manager.ts` | Multi-vault, per-tenant |
| `TenantVault` | `lib/security/tenant-vault.ts` | Access-controlled facade over `SecretManager` |
| GCP Secret Manager SDK | `@google-cloud/secret-manager` | Cloud-native secret storage |

**Recommendation:** KEEP all with clear layering. `TenantVault` → `EnterpriseSecretManager` → GCP/Vault/AWS/Azure.

### Legacy Files at Root

**Recommendation:** DEPRECATE after audit. See `AGENT_INTEGRATION_MAP.md` §Layer 5 for full list. Create a `legacy/` directory or remove in Phase 9B cleanup.

---

## Summary Decision Matrix

| Component | Decision | Phase |
|---|---|---|
| `EnterpriseAgentFramework` | ADAPT — expose via API, persist to Supabase | 9B |
| `AIProviderGateway` | KEEP — already correct abstraction | 9B |
| `IntegrationPlugin` interface | KEEP — extend with real implementations | 9E |
| `MarketplaceRegistry` | ADAPT — add API endpoint + browser UI | 9H |
| `EnterpriseSDKRegistry` | ADAPT — implement real SDK clients | 9B |
| `AutonomousPolicyEngine` | KEEP — add agent-scoped rule types | 9C |
| `PolicyEngine` (Supabase) | KEEP — add agent policy types | 9C |
| `AutonomousEventBus` | KEEP — already correct for cross-agent events | 9B |
| `TenantVault` | KEEP — use as agent secret accessor | 9C |
| `WorkflowRun.memory` (in-process) | MERGE → Redis/Supabase persistent memory | 9B |
| Legacy root scripts | DEPRECATE — review and archive | 9B |
| Legacy `api/grid/` | DEPRECATE — migrate to Next.js API routes | 9B |
| `server.js` | DEPRECATE — replaced by Next.js | 9B |

---

_This document was produced as part of Phase 9A analysis. No production code was modified._
