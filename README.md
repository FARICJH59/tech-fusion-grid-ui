# TechFusion Grid UI

A production-ready Next.js application for managing edge grid infrastructure and the HOARE enterprise/defense execution platform.

## HOARE Defense — DIB Supply Chain

The defense mission layer now includes a tenant-scoped **Defense Industrial Base (DIB) Supply Chain** service for supply-chain graph assessment, supplier risk scoring, provenance-gap detection, resilience analysis, critical-path identification, and governed response planning.

- `lib/enterprise/defense/dib-supply-chain.ts` — deterministic DIB graph/risk/action contracts
- `app/api/defense/dib/supply-chain/route.ts` — authenticated tenant-scoped API
- `docs/defense/DIB_SUPPLY_CHAIN_ARCHITECTURE.md` — architecture and execution boundary
- `tests/dib-supply-chain.test.ts` — assessment and boundary tests

The service is intentionally additive: intelligence is separated from execution, while approved actions remain inside the existing HOARE authorization, runtime, runbook, audit, and evidence layers.

## Phase 9B – Agent SDK Foundation

Phase 9B adds an additive Agent SDK contract layer without changing existing Tech Fusion Grid UI, HOARE-Agent runtime APIs, or Vercel deployment behavior.

- `packages/agent-sdk/` provides modular agent, capability, tool, memory, workflow, permission, evaluation, context, and event contracts
- `agentfusion/adapters/hoare-agent-adapter.ts` exposes the current `EnterpriseAgentFramework` through the new Agent SDK interfaces
- `docs/agent-platform/AGENT_SDK_ARCHITECTURE.md` documents the extension model, security posture, and integration path
- `tests/agent-sdk/` validates the SDK contracts, registries, permission evaluation, and HOARE adapter behavior

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

Tech-Fusion-Grid-UI now includes the Enterprise Control Plane foundation for HOARE.ai while preserving the existing App Router, API routes, MQTT execution plane, security, middleware and observability behavior.

### Enterprise layers implemented

1. **Enterprise Control Plane (`lib/enterprise/control-plane.ts`)**
   - Modules: Organizations, Tenants, Users, Projects, Workspaces, AI Providers, Infrastructure, Billing, Security, Observability, Deployment, Marketplace, DIB Supply Chain.
2. **HOARE Runtime Integration (`lib/enterprise/runtime.ts`)**
   - Services: Runtime Supervisor, Workflow Engine, Scheduler, Dispatcher, Event Bus, Health Manager, Auto Remediation, Agent Registry, MCP Gateway, SDK Manager, Tool Registry, Plugin Manager.
3. **AI Provider Abstraction (`lib/enterprise/providers.ts`)**
   - Providers: Google Gemini, Gemini Nano Banana, Gemini Omni Flash, Gemini 3.5, OpenAI, Anthropic.
   - Features: common interface, streaming, multimodal/image/video/embeddings/structured outputs, retries, failover, usage and cost tracking.
4. **Infrastructure Abstraction (`lib/enterprise/infrastructure.ts`)
   - Adapter registry for Docker, Kubernetes, Cloud Run, Redis, PostgreSQL, EMQX MQTT, NVIDIA GPU runtime, Object Storage.
5. **Enterprise Agent Framework (`lib/enterprise/agents.ts`)
   - Templates, orchestration, long-running workflows, event log, workflow memory, tool/knowledge-aware definitions, approval-ready lifecycle controls.
6. **Google Cloud Native (`lib/enterprise/cloud.ts`)
   - Standardized profile for project `caramel-limiter-495010-b9` with Cloud Run, Artifact Registry, Secret Manager, Cloud SQL, Pub/Sub, Cloud Scheduler, Cloud Logging, Cloud Monitoring, IAM Workload Identity Federation.
7. **Enterprise SDK (`lib/enterprise/sdk.ts`)
   - TypeScript SDK and Python SDK definitions across REST, Webhooks, WebSocket, MQTT channels.
8. **Marketplace (`lib/enterprise/marketplace.ts`)
   - Extension catalog support for tools, agents, models, workflows, templates, industry packs.
9. **Enterprise Security (`lib/enterprise/security.ts`)
   - RBAC + ABAC policy engine with tenant isolation checks and compatibility with JWT/OAuth/API key based control patterns.
10. **Revenue Platform (`lib/enterprise/revenue.ts`)
    - Usage metering, AI cost tracking, GPU tracking, marketplace billing and aggregated tenant analytics.

### New endpoints and UI

- `GET /api/platform/status` – full enterprise architecture and health snapshot
- `GET /api/runtime/status` – HOARE runtime service integration status
- `GET /api/operations/stream` – SSE live operations stream
- `GET /api/defense/dib/supply-chain` – DIB service metadata
- `POST /api/defense/dib/supply-chain` – tenant-scoped DIB assessment
- `/auth/login`, `/auth/signup`, `/auth/verify`, `/auth/forgot-password` – account-first auth surfaces
- `/platform` – enterprise control plane page
- `/operations` – real-time operations dashboard

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     Next.js App                      │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │  Pages   │  │  API     │  │  Instrumentation   │ │
│  │ /telemetry│  │ /auth    │  │  (OTel hooks)      │ │
│  │ /audit   │  │ /audit   │  └────────────────────┘ │
│  │ /execution│  │ /telemetry│                        │
│  └──────────┘  │ /health  │                         │
│                └──────────┘                          │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │                   lib/                       │   │
│  │  mqtt.ts   auth.ts   redis.ts   supabase.ts  │   │
│  │  env.ts    middleware/api.ts   telemetry/    │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────┬───────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼─────┐    ┌───────▼──────┐   ┌──────▼──────┐
   │ MQTT     │    │  Supabase/   │   │  Redis      │
   │ Broker   │    │  PostgreSQL  │   │  (cache +   │
   │(Mosquitto│    │              │   │   locks +   │
   │ / cloud) │    │              │   │   pub/sub)  │
   └──────────┘    └──────────────┘   └─────────────┘
```

## Quick start

```bash
# 1. Copy and edit environment variables
cp .env.example .env.local

# 2. Start all services (requires Docker)
docker compose up -d

# 3. Run the development server
npm run dev
```

## Services (Docker Compose)

| Service          | Port(s)         | Description                         |
|------------------|-----------------|-------------------------------------|
| `app`            | 3000            | Next.js application                 |
| `postgres`       | 5432            | PostgreSQL 16                       |
| `redis`          | 6379            | Redis 7 (cache + locks + pub/sub)   |
| `mosquitto`      | 1883, 8883, 9001| MQTT broker (plain, TLS, WS)        |
| `otel-collector` | 4317, 4318, 8888| OpenTelemetry Collector             |
| `jaeger`         | 16686           | Distributed tracing UI              |

## Environment variables

See [`.env.example`](.env.example) for the full list. Critical variables:

| Variable                   | Required | Description                              |
|----------------------------|----------|------------------------------------------|
| `SUPABASE_URL`             | Yes      | Supabase project URL                     |
| `SUPABASE_ANON_KEY`        | Yes      | Supabase anonymous key                   |
| `JWT_SECRET`               | Yes      | ≥ 32 chars; signs access + refresh tokens|
| `REDIS_URL`                | Yes      | Redis connection string                  |
| `MQTT_URL`                 | No       | MQTT broker URL; mock client if absent   |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No    | OTLP HTTP endpoint; no-op if absent      |

## Scripts

```bash
npm run dev        # Development server (port 3001)
npm run build      # Production build
npm run start      # Production server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # Node.js native test runner
```

### Auth flow

```
POST /api/auth
  { "email": "...", "password": "..." }
→ { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }

GET /api/telemetry
  Authorization: ******
→ { "data": [...], "count": N }
```

## Testing

```bash
npm run test   # unit tests including Enterprise Platform and DIB coverage
```

## CI/CD

`.github/workflows/ci.yml`:

1. **Quality** — `npm ci` → lint → typecheck → tests → build + artifact upload
2. **Audit** — `npm audit --audit-level=high`
3. **CodeQL** — JavaScript/TypeScript static analysis (security-extended query suite)
4. **Docker** — multi-stage image build verification
5. **Integration** — tests run against live Redis + Mosquitto services
6. **Readiness** — gate job on `main` listing remaining production blockers
