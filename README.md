# TechFusion Grid UI

A production-ready Next.js application for managing edge grid infrastructure, featuring real-time MQTT telemetry, JWT authentication, PostgreSQL persistence, Redis caching, and OpenTelemetry observability.

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

### New endpoints and UI

- `GET /api/platform/status` – full enterprise architecture and health snapshot
- `GET /api/runtime/status` – HOARE runtime service integration status
- `GET /api/operations/stream` – SSE live operations stream
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

## API routes

| Method | Route               | Auth          | Description                  |
|--------|---------------------|---------------|------------------------------|
| `POST` | `/api/auth`         | —             | Login → JWT tokens           |
| `POST` | `/api/auth/refresh` | —             | Refresh access token         |
| `GET`  | `/api/telemetry`    | viewer+       | Recent telemetry (tenant-scoped) |
| `GET`  | `/api/audit`        | operator+     | Audit log (tenant-scoped)    |
| `GET`  | `/api/health`       | —             | Liveness + dependency status |

### Auth flow

```
POST /api/auth
  { "email": "...", "password": "..." }
→ { "accessToken": "...", "refreshToken": "...", "expiresIn": 900 }

GET /api/telemetry
  Authorization: ******
→ { "data": [...], "count": N }
```

## MQTT client

`lib/mqtt.ts` exports a `mqttClient` singleton. When `MQTT_URL` is set it uses the real mqtt.js client; otherwise it falls back to `MockMQTT` for local development without a broker.

### Real client features
- TLS/mTLS via `mqtts://` with custom CA, client cert + key
- MQTT username / password authentication
- QoS 0, 1, 2 per publish/subscribe
- Retained messages
- Wildcard subscriptions (`#`, `+`)
- Last Will and Testament (LWT)
- Automatic exponential back-off reconnect (1 s → 30 s with jitter)
- Heartbeat monitoring via `packetreceive`
- Typed events preserving the existing execution-plane API

### API

```typescript
import { mqttClient } from "@/lib/mqtt";

mqttClient.connect();
const unsub = mqttClient.subscribe("edge/inverters/#", { qos: 1 });
const offMsg = mqttClient.on((topic, message) => console.log(topic, message));
mqttClient.publish("edge/faults", "overvoltage", { qos: 1, retain: false });
const offState = mqttClient.onConnectionStateChange((state) => console.log(state));
mqttClient.disconnect();
```

## Database migrations

SQL migrations live in `migrations/`. `001_init.sql` creates:

- `tenants` — multi-tenant root entity
- `users` — with role enum (`admin | operator | viewer | service`)
- `devices` — edge devices keyed by `tenant_id + device_key`
- `telemetry` — append-only JSONB time-series, indexed for range queries
- `audit_events` — structured audit log with actor reference
- `execution_history` — workflow run records with status enum
- `health_status` — periodic health snapshots

Run in PostgreSQL:
```sql
psql -U techfusion -d techfusion -f migrations/001_init.sql
```

## Authentication & RBAC

JWT access tokens (15 min) and refresh tokens (7 days) are signed with `JWT_SECRET`.

Role hierarchy (highest → lowest): `service > admin > operator > viewer`

```typescript
import { createTokens, verifyToken, hasMinRole } from "@/lib/auth";

const tokens = createTokens({ sub: userId, email, role: "operator", tenantId });
const payload = verifyToken(accessToken);
if (hasMinRole(payload.role, "admin")) { /* ... */ }
```

## Redis utilities

```typescript
import { cached, invalidate, acquireLock, subscribePubSub } from "@/lib/redis";

// Cache-aside pattern
const data = await cached("key", 60, () => fetchFromDB());

// Distributed lock (10 s TTL)
const release = await acquireLock("job:nightly-report");
if (release) { try { /* ... */ } finally { await release(); } }

// Pub/Sub
const unsubscribe = subscribePubSub(["events:telemetry"], (ch, msg) => {});
```

## Observability

OpenTelemetry is bootstrapped in `instrumentation.ts` (Next.js instrumentation hook). When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, traces are exported via OTLP HTTP. The structured logger in `lib/telemetry/otel.ts` outputs JSON in production, colourised text in development.

Access the local Jaeger UI at **http://localhost:16686** after `docker compose up`.

## Testing

```bash
npm run test   # unit tests including Enterprise Platform foundation coverage
```

Test files:
- `tests/mqtt.integration.test.ts` — MockMQTT API contract
- `tests/mqtt-client.test.ts` — extended MQTT client behavioural tests
- `tests/auth.test.ts` — JWT creation, verification, RBAC, token extraction
- `tests/telemetry-runtime.integration.test.ts` — WebSocket telemetry runtime
- `tests/enterprise-platform.test.ts` — enterprise architecture, provider abstraction, runtime integration, SDK, security, and revenue foundation

## CI/CD

`.github/workflows/ci.yml`:

1. **Quality** — `npm ci` → lint → typecheck → tests → build + artifact upload
2. **Audit** — `npm audit --audit-level=high`
3. **CodeQL** — JavaScript/TypeScript static analysis (security-extended query suite)
4. **Docker** — multi-stage image build verification
5. **Integration** — tests run against live Redis + Mosquitto services
6. **Readiness** — gate job on `main` listing remaining production blockers

## Production checklist

- [ ] Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Set `JWT_SECRET` to a cryptographically random string ≥ 32 chars
- [ ] Enable Row Level Security (RLS) policies in Supabase for tenant isolation
- [ ] Run database migration `001_init.sql`
- [ ] Configure MQTT broker with TLS + ACL rules
- [ ] Set `REDIS_URL` to a production Redis instance (TLS recommended)
- [ ] Configure `OTEL_EXPORTER_OTLP_ENDPOINT` for production tracing
- [ ] Switch rate limiter in `lib/middleware/api.ts` from in-process to Redis-backed for multi-node deployments
- [ ] Set up log aggregation (Datadog, Loki, etc.) consuming the JSON log output
- [ ] Add Prometheus scrape endpoint if needed (extend `lib/telemetry/otel.ts`)
