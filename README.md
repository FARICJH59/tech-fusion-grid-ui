# TechFusion Grid UI / HOARE Platform

A production-ready Next.js application and enterprise control-plane foundation for **HOARE.ai**: an agentic operations platform designed to coordinate governed AI agents, edge infrastructure, workflows, telemetry, security policy, and enterprise execution.

The platform is built to support commercial enterprise workloads and high-assurance environments, including **defense, critical infrastructure, industrial operations, and other mission-sensitive deployments**. Defense positioning is an application of the existing architecture—not a separate codebase or a claim of certification.

## Platform position

HOARE is being developed as a governed **agentic execution and operations layer** between enterprise intent and real infrastructure.

```text
Enterprise / Mission Intent
          │
          ▼
┌───────────────────────────────┐
│ HOARE Control Plane           │
│ tenants • policy • identity   │
│ workflows • agents • billing  │
└──────────────┬────────────────┘
               │ governed actions
               ▼
┌───────────────────────────────┐
│ HOARE Agent / Workflow Runtime │
│ registry • scheduler • MCP     │
│ tools • memory • events        │
│ approvals • evaluation         │
└──────────────┬────────────────┘
               │ policy-checked execution
               ▼
┌───────────────────────────────┐
│ AEGIS Security Boundary       │
│ identity • policy • evidence  │
│ action authorization • audit  │
└──────────────┬────────────────┘
               │
        ┌──────┴────────┐
        ▼               ▼
   Cloud / SaaS      Edge / Mission
   Cloud Run         MQTT / IoT
   GCP / Redis       devices / gateways
   PostgreSQL        rugged / isolated nodes
```

### Defense and mission-oriented capabilities

The architecture is intentionally extensible toward defense and other high-assurance environments:

- **Mission workflow orchestration** — coordinate multi-step operational workflows and long-running agent tasks.
- **Edge-to-cloud execution** — connect governed agent decisions to MQTT-connected edge systems and cloud services.
- **Policy-controlled autonomy** — separate agent reasoning from authorization to execute consequential actions.
- **Evidence and auditability** — preserve operational events, execution history, policy decisions, and telemetry for review.
- **Tenant and deployment isolation** — maintain tenant-scoped identity, policy, data, credentials, and runtime boundaries.
- **Defense supply-chain workflows** — provide a foundation for supplier intelligence, bottleneck detection, operational coordination, compliance workflows, and program-level decision support.
- **Human approval paths** — support approval-ready lifecycle controls for actions that should not execute autonomously.
- **Air-gapped / rugged-silo direction** — the platform abstractions are designed to permit isolated deployment patterns where connectivity and data-perimeter requirements demand them.

> **Important:** These capabilities describe the platform architecture and intended deployment patterns. They do not by themselves constitute DoD authorization, ATO, FedRAMP authorization, CMMC certification, ITAR certification, or any other regulatory/security certification.

## Phase 9B – Agent SDK Foundation

Phase 9B adds an additive Agent SDK contract layer without changing existing Tech Fusion Grid UI, HOARE-Agent runtime APIs, or Vercel deployment behavior.

- `packages/agent-sdk/` provides modular agent, capability, tool, memory, workflow, permission, evaluation, context, and event contracts
- `agentfusion/adapters/hoare-agent-adapter.ts` exposes the current `EnterpriseAgentFramework` through the new Agent SDK interfaces
- `docs/agent-platform/AGENT_SDK_ARCHITECTURE.md` documents the extension model, security posture, and integration path
- `tests/agent-sdk/` validates the SDK contracts, registries, permission evaluation, and HOARE adapter behavior

### Agentic workflow / canvas direction

The Agent SDK is intended to make complex agentic workflows **visible, steerable, replayable, and governable** rather than treating an agent as an opaque chat endpoint.

A future canvas/workflow surface can represent:

1. **Intent** — what the operator or organization wants accomplished.
2. **Agents** — specialized reasoning or operational roles.
3. **Tools** — explicitly registered capabilities an agent may invoke.
4. **Policies** — constraints governing whether an action is permitted.
5. **Approvals** — human gates for sensitive actions.
6. **Execution** — observable, event-driven workflow runs.
7. **Evidence** — inputs, outputs, telemetry, decisions, and audit records.
8. **Evaluation** — replay and assessment of agent/workflow behavior.

This preserves a clean distinction between **planning, authorization, and execution**.

## Security architecture

Security is treated as a platform boundary rather than an agent prompt instruction.

### Core controls

- RBAC + ABAC policy contracts
- tenant isolation checks
- JWT/OAuth/API-key-compatible control patterns
- Workload Identity Federation posture for Google Cloud
- no long-lived service-account keys as the preferred cloud authentication model
- MQTT TLS/mTLS and ACL support
- structured audit events
- approval-ready execution lifecycle
- policy versioning for tenant, deployment, runtime, and remediation decisions

### AEGIS boundary

**AEGIS** is the security/policy enforcement direction around consequential agent actions. HOARE may reason about an action; the security boundary determines whether that action is authorized under the applicable identity, tenant, policy, environment, and operational state.

This separation is important for defense-oriented deployments because autonomy should not imply unrestricted authority.

## Phase 7 – Cloud Native Enterprise Platform

Phase 7 extends the platform into a cloud-native enterprise operating layer:

- Google Cloud SDK runtime integration (`lib/enterprise/cloud-runtime.ts`) for Cloud Run, Pub/Sub, Secret Manager, Logging, Monitoring, Artifact Registry
- Workload Identity Federation-only posture (no long-lived service account keys)
- Durable runtime-state contracts for Supabase/PostgreSQL + Redis (`lib/enterprise/runtime-state.ts`)
- Enterprise MQTT hardening contracts (`lib/enterprise/messaging.ts`)
- Policy engine contracts with versioned tenant/deployment/runtime/remediation policy persistence (`lib/enterprise/policy-engine.ts`)
- AI cost telemetry + optimization recommendations (`lib/enterprise/cost-engine.ts`)
- Autonomous scaling plan synthesis for Cloud Run (`lib/enterprise/scaling.ts`)
- Multi-region fleet placement/failover (`lib/enterprise/fleet.ts`)
- Plugin-based enterprise connector layer (`lib/enterprise/integrations.ts`)
- Real-time operations streaming via SSE (`app/api/operations/stream/route.ts`, `app/operations/page.tsx`)
- Alert manager abstractions for Slack/PagerDuty/Email (`lib/enterprise/alerts.ts`)

## Phase 5 – HOARE Enterprise Platform Foundation

Tech-Fusion-Grid-UI includes the Enterprise Control Plane foundation for HOARE.ai while preserving the existing App Router, API routes, MQTT execution plane, security, middleware and observability behavior.

### Enterprise layers implemented

1. **Enterprise Control Plane (`lib/enterprise/control-plane.ts`)**
   - Modules: Organizations, Tenants, Users, Projects, Workspaces, AI Providers, Infrastructure, Billing, Security, Observability, Deployment, Marketplace.
2. **HOARE Runtime Integration (`lib/enterprise/runtime.ts`)**
   - Services: Runtime Supervisor, Workflow Engine, Scheduler, Dispatcher, Event Bus, Health Manager, Auto Remediation, Agent Registry, MCP Gateway, SDK Manager, Tool Registry, Plugin Manager.
3. **AI Provider Abstraction (`lib/enterprise/providers.ts`)**
   - Providers: Google Gemini, Gemini Nano Banana, Gemini Omni Flash, Gemini 3.5, OpenAI, Anthropic.
   - Features: common interface, streaming, multimodal/image/video/embeddings/structured outputs, retries, failover, usage and cost tracking.
4. **Infrastructure Abstraction (`lib/enterprise/infrastructure.ts`)**
   - Adapter registry for Docker, Kubernetes, Cloud Run, Redis, PostgreSQL, EMQX MQTT, NVIDIA GPU runtime, Object Storage.
5. **Enterprise Agent Framework (`lib/enterprise/agents.ts`)**
   - Templates, orchestration, long-running workflows, event log, workflow memory, tool/knowledge-aware definitions, approval-ready lifecycle controls.
6. **Google Cloud Native (`lib/enterprise/cloud.ts`)**
   - Standardized profile for project `caramel-limiter-495010-b9` with Cloud Run, Artifact Registry, Secret Manager, Cloud SQL, Pub/Sub, Cloud Scheduler, Cloud Logging, Cloud Monitoring, IAM Workload Identity Federation.
7. **Enterprise SDK (`lib/enterprise/sdk.ts`)**
   - TypeScript SDK and Python SDK definitions across REST, Webhooks, WebSocket, MQTT channels.
8. **Marketplace (`lib/enterprise/marketplace.ts`)**
   - Extension catalog support for tools, agents, models, workflows, templates, industry packs.
9. **Enterprise Security (`lib/enterprise/security.ts`)**
   - RBAC + ABAC policy engine with tenant isolation checks and compatibility with JWT/OAuth/API key based control patterns.
10. **Revenue Platform (`lib/enterprise/revenue.ts`)**
    - Usage metering, AI cost tracking, GPU tracking, marketplace billing and aggregated tenant analytics.

## Enterprise and defense execution model

HOARE should be understood as a **platform layer**, not merely an AI assistant.

```text
Observe → Understand → Plan → Authorize → Execute → Verify → Record → Learn
```

- **Observe:** telemetry, events, health signals, documents, operator input, and external system state.
- **Understand:** agent reasoning, classification, retrieval, vision, and context assembly.
- **Plan:** produce a structured workflow or action proposal.
- **Authorize:** evaluate identity, tenant, role, policy, environment, risk, and approval requirements.
- **Execute:** invoke registered tools, APIs, cloud resources, edge commands, or workflows.
- **Verify:** inspect execution result and system state.
- **Record:** persist audit/evidence/event data.
- **Learn:** evaluate outcomes and improve future workflow behavior without bypassing policy.

For consequential operations, **execution authority remains outside the model itself**.

## New endpoints and UI

- `GET /api/platform/status` – full enterprise architecture and health snapshot
- `GET /api/runtime/status` – HOARE runtime service integration status
- `GET /api/operations/stream` – SSE live operations stream
- `/auth/login`, `/auth/signup`, `/auth/verify`, `/auth/forgot-password` – account-first auth surfaces
- `/platform` – enterprise control plane page
- `/operations` – real-time operations dashboard

## Architecture

```text
┌────────────────────────────────────────────────────────────┐
│                     HOARE / TechFusion                    │
│                                                            │
│  Intent → Agents → Workflow → Policy/AEGIS → Execution     │
│                                                            │
│  ┌─────────────── Control Plane ────────────────────────┐  │
│  │ Tenants • Identity • Policy • Billing • Marketplace │  │
│  │ Providers • Deployment • Observability • Security   │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                  │
│  ┌────────────── Runtime / Agent Plane ────────────────┐  │
│  │ Agent Registry • MCP • Tools • Memory • Workflows   │  │
│  │ Scheduler • Dispatcher • Events • Evaluation        │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                  │
│  ┌─────────────── Execution / Edge Plane ──────────────┐  │
│  │ Cloud Run • APIs • MQTT • Edge Devices • GPUs       │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                  │
│  ┌────────────── Data / Evidence / Telemetry ──────────┐  │
│  │ PostgreSQL • Redis • Audit • Events • OpenTelemetry │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

## Quick start

```bash
cp .env.example .env.local
docker compose up -d
npm run dev
```

## Services (Docker Compose)

| Service | Port(s) | Description |
|---|---|---|
| `app` | 3000 | Next.js application |
| `postgres` | 5432 | PostgreSQL 16 |
| `redis` | 6379 | Redis 7 (cache + locks + pub/sub) |
| `mosquitto` | 1883, 8883, 9001 | MQTT broker (plain, TLS, WS) |
| `otel-collector` | 4317, 4318, 8888 | OpenTelemetry Collector |
| `jaeger` | 16686 | Distributed tracing UI |

## Environment variables

See [`.env.example`](.env.example) for the full list. Critical variables:

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `JWT_SECRET` | Yes | ≥ 32 chars; signs access + refresh tokens |
| `REDIS_URL` | Yes | Redis connection string |
| `MQTT_URL` | No | MQTT broker URL; mock client if absent |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | OTLP HTTP endpoint; no-op if absent |

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run test
```

## API routes

| Method | Route | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth` | — | Login → JWT tokens |
| `POST` | `/api/auth/login` | — | Login alias |
| `POST` | `/api/auth/signup` | — | Signup + tenant provisioning bootstrap |
| `POST` | `/api/auth/verify` | — | OTP/email verification + token issue |
| `POST` | `/api/auth/forgot-password` | — | Password reset initiation |
| `POST` | `/api/auth/refresh` | — | Refresh access token |
| `GET` | `/api/telemetry` | viewer+ | Recent tenant-scoped telemetry |
| `GET` | `/api/audit` | operator+ | Tenant-scoped audit log |
| `GET` | `/api/health` | — | Liveness + dependency status |
| `GET` | `/api/platform/entitlements` | viewer+ | Subscription + credit feature gates |
| `POST` | `/api/billing/portal` | viewer+ | Billing portal entrypoint |
| `POST` | `/api/billing/stripe/webhook` | Stripe signature | Subscription activation sync |

## MQTT execution plane

`lib/mqtt.ts` exports a `mqttClient` singleton. When `MQTT_URL` is set it uses the real mqtt.js client; otherwise it falls back to `MockMQTT` for local development without a broker.

Real-client capabilities include TLS/mTLS, username/password authentication, QoS 0/1/2, retained messages, wildcard subscriptions, Last Will and Testament, exponential reconnect back-off, heartbeat monitoring, and typed execution-plane events.

## Database migrations

SQL migrations live in `migrations/`. `001_init.sql` creates tenants, users, devices, telemetry, audit events, execution history, and health status structures.

## Authentication & RBAC

JWT access tokens (15 min) and refresh tokens (7 days) are signed with `JWT_SECRET`.

Role hierarchy (highest → lowest): `service > admin > operator > viewer`.

## Redis utilities

Redis provides cache-aside helpers, distributed locks, and Pub/Sub utilities used by runtime and operational workflows.

## Observability

OpenTelemetry is bootstrapped in `instrumentation.ts`. When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, traces are exported through OTLP HTTP. Structured logs are emitted by the telemetry layer.

## Testing

```bash
npm run test
```

Coverage includes MQTT contracts, authentication/RBAC, telemetry runtime, enterprise platform foundations, and Agent SDK contracts.

## CI/CD

`.github/workflows/ci.yml` performs quality checks, security audit, CodeQL analysis, Docker verification, integration testing, and readiness gating.

## Production / high-assurance deployment checklist

- [ ] Configure Supabase/PostgreSQL production credentials and tenant RLS policies
- [ ] Set a cryptographically random `JWT_SECRET` ≥ 32 characters
- [ ] Configure production MQTT TLS/mTLS and ACL rules
- [ ] Configure production Redis with TLS where appropriate
- [ ] Configure OpenTelemetry export and centralized logging
- [ ] Use Workload Identity Federation rather than long-lived cloud service-account keys
- [ ] Validate tenant isolation and authorization policies
- [ ] Validate AEGIS/policy enforcement for consequential tools and actions
- [ ] Configure approval gates for actions requiring human authorization
- [ ] Validate evidence/audit retention requirements for the deployment environment
- [ ] Validate network segmentation, private connectivity, secrets management, and endpoint controls
- [ ] For defense or other regulated deployments, complete the applicable organizational authorization, security, export-control, contractual, and compliance processes before production use

## Roadmap

The architecture is intentionally additive and sequential:

1. **Core Grid UI and execution plane** — telemetry, authentication, MQTT, persistence, caching, observability.
2. **Enterprise Control Plane** — tenants, organizations, billing, security, infrastructure, deployment, marketplace.
3. **HOARE Runtime** — agents, workflows, scheduler, dispatcher, events, memory, tools, MCP.
4. **Agent SDK** — reusable contracts for agents, capabilities, tools, memory, workflows, permissions, evaluation, context, and events.
5. **Governed autonomy** — policy evaluation, approval gates, evidence, verification, and controlled remediation.
6. **AEGIS security boundary** — explicit authorization and policy enforcement around consequential agent actions.
7. **Mission/defense workflows** — operational coordination, edge execution, supply-chain intelligence, and high-assurance workflow patterns.
8. **Canvas-based agentic operations** — visual, steerable, replayable workflows with observable execution and cost-aware orchestration.
9. **Multi-environment deployment** — cloud, edge, rugged, isolated, and air-gapped deployment patterns as supported by the target environment.

The roadmap does not imply that every future capability is currently production-enabled. The repository should distinguish implemented contracts from deployment-dependent capabilities and future integrations.

## License / status

TechFusion Grid UI is an evolving enterprise platform foundation. Features marked as contracts, adapters, roadmap items, or deployment patterns should be validated against the implementation and target environment before being represented as production guarantees.
