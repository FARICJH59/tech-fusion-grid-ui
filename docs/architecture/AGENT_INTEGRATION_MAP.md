# AGENT_INTEGRATION_MAP.md

**Phase 9A.3 — Agent Integration Map**
_Tech Fusion Grid + HOARE.ai Agentic Platform_
_Generated: 2026-07-11 | Status: Analysis Only — No Production Code Modified_

---

## Overview

This document maps every existing integration point, communication path, and system boundary relevant to evolving the platform into the AgentFusion architecture. It covers five layers: Experience, Agent, Cloud, Data, and Integration.

---

## Layer 1 — Experience Layer

### Tech Fusion Grid UI

| Component | Type | Integration Points | Notes |
|---|---|---|---|
| `app/page.tsx` | Next.js page | Links to all modules | Dashboard entry point; displays Active Agents, IoT Devices, Events/sec, Runtime Health |
| `app/telemetry/` | Next.js page | `GET /api/telemetry` | OTel telemetry visualization |
| `app/execution-plane/` | Next.js page | `GET /api/runtime/status` | Cloud Run execution plane |
| `app/audit/` | Next.js page | `GET /api/audit` | Audit log browser |
| `app/platform/` | Next.js page | `GET /api/platform/status` | Enterprise control plane dashboard |
| `app/operations/` | Next.js page | `GET /api/operations/stream` (SSE) | Real-time autonomous operations feed |
| `app/auth/` | Next.js pages | `POST /api/auth` | Login / signup / password reset |
| `components/GridPipelineCanvas.tsx` | React component | IoT grid visualization | Real-time pipeline canvas |
| `components/TelemetryChart.jsx` | React component | Telemetry data rendering | Time-series chart |
| `components/billing/` | React component | `GET/POST /api/billing` | Billing portal (admin/operator only) |

### HOARE.ai Application Surface

| Surface | Current Status | Integration Readiness |
|---|---|---|
| Agent management UI | Not yet implemented | Needs Phase 9B Agent SDK before UI layer |
| HOARE StyleAI vertical | Not yet implemented | Planned for Phase 9F |
| Agent marketplace browser | Not yet implemented | `MarketplaceRegistry` scaffold exists |
| Agent evaluation dashboard | Not yet implemented | Needs Phase 9C evaluation framework |

---

## Layer 2 — Agent Layer

### HOARE-Agent Core

| Capability | Location | Integration Points | Status |
|---|---|---|---|
| Agent Template Registry | `EnterpriseAgentFramework.templates` | Internal — no API | ✅ Implemented (in-process only) |
| Agent Lifecycle Manager | `EnterpriseAgentFramework.updateLifecycle()` | Internal — no API | ✅ Implemented (in-process only) |
| Workflow Orchestrator | `EnterpriseAgentFramework.startWorkflow()` | Internal — no API | ✅ Implemented (in-process only) |
| Memory System | `EnterpriseAgentFramework.writeMemory()` | In-process key-value | ✅ Implemented (in-memory only) |
| Event-driven Execution | `AutonomousEventBus.subscribe()` | Redis Streams + in-process | ✅ Implemented |
| Approval Gateway | `ApprovalFlow` + `AutonomousPolicyEngine` | Policy engine → approval flow | ✅ Implemented |
| Tool Execution | `AgentTemplate.tools` field | Declared only | ⚠️ Not yet wired |
| Knowledge Retrieval | `AgentTemplate.knowledgeSources` field | Declared only | ⚠️ Not yet wired |
| Agent Versioning | `AgentDefinition.version` field | Declared only | ⚠️ No version history |
| Cross-agent communication | — | None | ❌ Not implemented |
| Agent evaluation | — | None | ❌ Not implemented |
| External Agent SDK | — | None | ❌ Not implemented |

### AgentFusion Runtime (Planned)

The `EnterpriseAgentFramework` serves as the foundation. The integration map for the planned AgentFusion runtime:

```
External SDK / HOARE-Agent
        │
        ▼
  Agent Registry API  ──────────►  EnterpriseAgentFramework (existing)
        │                                      │
        ▼                                      ▼
  Workflow Orchestrator  ──────►  AutonomousEventBus (existing)
        │
        ├──► AI Provider Gateway (existing: providers.ts)
        ├──► Tool Connector Framework (new: Phase 9E)
        ├──► Memory System (new: persistent Redis/Supabase)
        ├──► Policy Engine (existing: lib/policy/engine.ts)
        └──► Evaluation Framework (new: Phase 9C)
```

---

## Layer 3 — Cloud Layer (Phase 8 Autonomous Cloud Control Plane)

### Cloud Control Plane Components

| Component | File | Inputs | Outputs |
|---|---|---|---|
| `CloudRunController` | `lib/cloud/cloud-run-controller.ts` | `deploy()` / `migrateTraffic()` calls | `DeploymentRecord`, `CloudRunRevisionStatus` |
| `GcpCloudClient` | `lib/cloud/gcp-client.ts` | GCP WIF credentials | Cloud Run API calls |
| `DeploymentManager` | `lib/cloud/deployment-manager.ts` | Deployment requests | State-machine transitions |
| `RollbackEngine` | `lib/cloud/rollback-engine.ts` | Failed health checks | Traffic revert + audit |
| `IntelligentScalingEngine` | `lib/cloud/scaling-engine.ts` | CPU/request metrics | `ScalingDecision` |
| `RemediationLoop` | `lib/cloud/remediation-loop.ts` | SLO breach events | Auto-remediation actions |
| `AutonomousPolicyEngine` | `lib/policy/engine.ts` | `CloudActionEvent` | `PolicyDecision` (approve/escalate/reject) |

### Cloud Action Event Flow

```
Deploy Request
      │
      ▼
DeploymentManager.request()  →  State: "requested"
      │
      ▼
AutonomousPolicyEngine.evaluate()
      │
  ┌───┴───────────────────┐
  │ approve               │ reject / escalate
  ▼                       ▼
CloudRun.deployService()  ApprovalFlow (human review)
      │
      ▼
GcpCloudClient.verifyHealth()
      │
  ┌───┴──────────────┐
  │ healthy          │ unhealthy
  ▼                  ▼
"completed"    RollbackEngine.execute()
      │
      ▼
AutonomousEventBus.publish()  →  Redis Streams  →  SSE /api/operations/stream
```

### Cloud Layer Integration Points for AgentFusion

| Integration | Direction | Notes |
|---|---|---|
| Agent deploys Cloud Run service | Agent → `CloudRunController.deploy()` | Policy-gated, requires approval for high-risk |
| Agent reads deployment status | Agent → `GcpCloudClient.getDeploymentStatus()` | Read-only safe |
| Agent scales workloads | Agent → `IntelligentScalingEngine.decide()` | CPU/request signal input |
| Cloud events trigger agent workflows | `AutonomousEventBus` → Agent subscriptions | Already connected via event bus |
| Agent accesses secrets | Agent → `TenantVault.getSecret()` | RBAC-gated, audited |

---

## Layer 4 — Data Layer

### PostgreSQL / Supabase

| Table | Purpose | Migration | RLS |
|---|---|---|---|
| Core tenant tables | Org/tenant/user hierarchy | `001_init.sql` | ✅ |
| `phase7_cloud_services` | Cloud service registry | `002_phase7_cloud_native_platform.sql` | ✅ |
| `phase7_policies` | Tenant policy records | `002_phase7_cloud_native_platform.sql` | ✅ |
| `phase7_audit_logs` | Audit trail | `002_phase7_cloud_native_platform.sql` | ✅ |
| Phase 8 autonomous tables | Cloud actions, deployments | `003_phase8_autonomous_cloud_control.sql` | ✅ |
| Phase 8.5 production tables | Production hardening records | `004_phase8_5_production_hardening.sql` | ✅ |
| Phase 9 billing tables | Account, billing, credits | `005_phase9_account_billing_foundation.sql` | ✅ |

**Agent data not yet persisted** — agent templates, definitions, and workflow runs live only in the in-process `EnterpriseAgentFramework` maps. Persistent agent store is required for Phase 9B.

### Redis

| Use | Key Pattern | Notes |
|---|---|---|
| Rate limiting | `rl:{ip}:{route}` | Sliding window, in-process fallback |
| Distributed locks | `lock:{resource}` | Mutex for concurrent operations |
| Pub/Sub | Redis Pub/Sub channels | Real-time messaging |
| Autonomous Event Stream | `phase85:autonomous-events` | Redis Streams XADD/XREAD |
| Dead Letter Queue | `phase85:autonomous-events:dlq` | Failed event storage |
| Event Idempotency | `phase85:idempotency:{dedupeKey}` | 1-hour TTL deduplication |
| Cache | General key-value | `lib/redis.ts` |

**Agent memory currently in-process only.** Redis Streams are the natural integration point for persistent, multi-agent memory in Phase 9B/9C.

### MQTT / EMQX / Mosquitto

| Topic Pattern | Purpose | Broker |
|---|---|---|
| `iot/#` | IoT device telemetry | Eclipse Mosquitto (dev), EMQX (prod) |
| `runtime/#` | Runtime status events | EMQX |
| `runtime/dead-letter` | Failed message routing | EMQX (`MessagingPolicy.deadLetterTopic`) |
| `healthcheck` | Broker health probe | Mosquitto |
| Per-tenant ACL topics | Tenant-scoped messaging | EMQX with mTLS + x509 auth |

**MQTT ↔ Agent integration:** IoT events are currently consumed by `lib/mqtt.ts` but not yet routed to agent workflows. This is a key integration point for Phase 9D HOARE-Agent.

### Event System

```
AutonomousEventBus (lib/events/event-bus.ts)
    │
    ├── In-process pub/sub (Set<Subscriber>)
    ├── Redis Streams (phase85:autonomous-events)  [when REDIS_URL set]
    ├── Dead Letter Queue (phase85:autonomous-events:dlq)
    └── ReplayManager (lib/events/replay-manager.ts) → last 2,000 events in-process
```

Event types: `cloud-action`, `deployment`, `approval`, `scaling`, `rollback`, `incident`, `slo-breach`, `recovery`, `operator-override`, `operations-snapshot`

---

## Layer 5 — Integration Layer

### Enterprise Connector Framework (`lib/enterprise/integrations.ts`)

All connectors implement `IntegrationPlugin` interface:

```typescript
interface IntegrationPlugin {
  readonly name: ConnectorName;
  execute(context: IntegrationContext): Promise<IntegrationResult>;
}
```

| Connector | Category | Status | AgentFusion Role |
|---|---|---|---|
| GitHub | DevOps | Stub registered | Code deployment triggers, PR workflows |
| GitHub Copilot | AI | Stub registered | Code generation tool for agents |
| Google Workspace | Productivity | Stub registered | Document/calendar access for agents |
| Microsoft 365 | Productivity | Stub registered | Email/Teams notifications |
| Stripe | Payments | Stub registered | Billing events, subscription management |
| Jira | Project Mgmt | Stub registered | Issue creation from agent actions |
| ServiceNow | ITSM | Stub registered | Incident ticket creation |
| Salesforce | CRM | Stub registered | Customer data access for agents |
| Datadog | Observability | Stub registered | External metric ingestion |
| Grafana | Dashboards | Stub registered | Dashboard webhook triggers |

**Architecture note:** The `IntegrationPlugin` interface is already the correct abstraction for the Phase 9E Connector Framework. Stubs need real implementations, not a new interface.

### AI Provider Gateway (`lib/enterprise/providers.ts`)

```
AIProviderGateway
    │
    ├── Google Gemini      (text, multimodal, image, video, embeddings, structured)
    ├── Gemini Nano Banana (text, multimodal, image, video, embeddings, structured)
    ├── Gemini Omni Flash  (text, multimodal, image, video, embeddings, structured)
    ├── Gemini 3.5         (text, multimodal, image, video, embeddings, structured)
    ├── OpenAI             (text, multimodal, image, video, embeddings, structured)
    └── Anthropic          (text, multimodal, image, video, embeddings, structured)

Features:
- Automatic failover (provider health check)
- Preferred provider routing
- Retry with configurable max attempts
- Cost telemetry → CostOptimizationEngine
- Streaming (AsyncGenerator)
- Usage snapshot per provider
```

### External APIs (Legacy Files — Audit Finding)

The following files exist at the repository root and represent legacy or exploratory scripts that are **not part of the Next.js application**:

| File | Type | Status |
|---|---|---|
| `server.js` | Standalone Node server | Legacy — pre-Next.js |
| `harvester.js` | Data harvesting script | Legacy script |
| `listener.js` | Event listener script | Legacy script |
| `fetch_market_signals.js` | Market data fetcher | Legacy script |
| `simulated-hardware.js` | IoT simulation | Dev tool |
| `telemetry_server.py` | Python telemetry server | Dev tool |
| `compliance_auditor.py` | Python compliance script | Dev tool |
| `api/grid/` | Legacy grid API | Pre-migration artifact |
| `dashboard_closure.js` | Dashboard utility | Legacy |
| `index_completion.js` | Completion handler | Legacy |
| `audit_system.sh` | Shell audit script | Dev tool |
| `generate_report.sh` | Report generator | Dev tool |
| `index.html`, `landing.html`, `login.html` | Static HTML | Legacy pre-React UI |

**Recommendation:** These files should be reviewed in Phase 9B — they may contain business logic worth migrating or should be formally deprecated.

---

## Integration Gap Summary

| Gap | Impact | Required Phase |
|---|---|---|
| No external Agent SDK | Cannot build integrations against agent framework | Phase 9B |
| No Agent Registry API endpoint | Cannot discover/manage agents via API | Phase 9B |
| Tool execution not wired | Agent templates declare tools but cannot call them | Phase 9C |
| Knowledge retrieval not wired | Agent templates declare knowledge sources but cannot query them | Phase 9C |
| Agent memory is in-process | Memory lost on restart; no cross-agent sharing | Phase 9B/9C |
| No MQTT → Agent bridge | IoT events don't trigger agent workflows | Phase 9D |
| No industry-specific agent templates | Single `runtime-operator` template | Phase 9F/9G |
| Connector stubs not implemented | 10 connectors registered but all return mock results | Phase 9E |
| No evaluation framework | Cannot measure agent accuracy/performance | Phase 9C |
| No agent marketplace API | `MarketplaceRegistry` has no API route | Phase 9H |

---

_This document was produced as part of Phase 9A analysis. No production code was modified._
