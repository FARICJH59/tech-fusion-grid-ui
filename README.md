# TechFusion Grid UI

A production-ready Next.js application for managing edge grid infrastructure, featuring real-time MQTT telemetry, JWT authentication, PostgreSQL persistence, Redis caching, and OpenTelemetry observability.

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
npm run test   # 87 unit + integration tests
```

Test files:
- `tests/mqtt.integration.test.ts` — MockMQTT API contract
- `tests/mqtt-client.test.ts` — extended MQTT client behavioural tests
- `tests/auth.test.ts` — JWT creation, verification, RBAC, token extraction
- `tests/telemetry-runtime.integration.test.ts` — WebSocket telemetry runtime
- `tests/api-middleware.test.ts` — withAuth, withRateLimit, withValidation, withErrorHandler
- `tests/api-integration.test.ts` — full authenticated tenant flows, correlation IDs
- `tests/health-failure.test.ts` — health probe logic under dependency failures
- `tests/mqtt-reconnect.test.ts` — MockMQTT reconnect and state-change tests
- `tests/retry.test.ts` — exponential backoff retry utility
- `tests/circuit-breaker.test.ts` — circuit breaker state machine

## CI/CD

`.github/workflows/ci.yml`:

1. **Quality** — `npm ci` → lint → typecheck → tests → build + artifact upload
2. **Audit** — `npm audit --audit-level=high`
3. **CodeQL** — JavaScript/TypeScript static analysis (security-extended query suite)
4. **Docker** — multi-stage image build verification
5. **Integration** — tests run against live Redis + Mosquitto services
6. **Readiness** — gate job on `main` listing remaining production blockers

## Database migrations

| File | Description |
|------|-------------|
| `migrations/001_init.sql` | Initial schema: tenants, users, devices, telemetry, audit_events, execution_history, health_status |
| `migrations/002_rls.sql` | Row Level Security policies for multi-tenant isolation |

Run in order:
```sql
psql -U techfusion -d techfusion -f migrations/001_init.sql
psql -U techfusion -d techfusion -f migrations/002_rls.sql
```

> **Note on RLS and custom JWTs:** `002_rls.sql` uses `auth.jwt() ->> 'tenantId'` to enforce
> tenant isolation at the database layer. For this to work, set the Supabase project JWT secret to
> match `JWT_SECRET` so that tokens issued by `lib/auth.ts` are recognised by Supabase.  Server-side
> API routes use the service-role client (`SUPABASE_SERVICE_ROLE_KEY`), which bypasses RLS; the
> `.eq("tenant_id", user.tenantId)` filter in each route provides primary application-level isolation.

## Legacy server.js

`server.js` is a **deprecated** Express prototype. All endpoints have been superseded by the Next.js
App Router routes under `app/api/`. It must not be used in production.

## Production checklist

- [x] Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [x] Set `JWT_SECRET` to a cryptographically random string ≥ 32 chars
- [x] Run database migrations `001_init.sql` then `002_rls.sql`
- [x] Configure Supabase JWT secret to match `JWT_SECRET` to activate RLS policies
- [x] Enable Row Level Security (RLS) policies applied by `002_rls.sql`
- [x] Redis-backed rate limiter — automatically used when `REDIS_URL` is set
- [ ] Configure MQTT broker with TLS + ACL rules
- [ ] Set `REDIS_URL` to a production Redis instance (TLS recommended)
- [ ] Configure `OTEL_EXPORTER_OTLP_ENDPOINT` for production tracing
- [ ] Set up log aggregation (Datadog, Loki, etc.) consuming the JSON log output
- [ ] Add Prometheus scrape endpoint if needed (extend `lib/telemetry/otel.ts`)

---

## Phase 4B — Production Deployment & Observability Hardening

### Deployment target: Google Cloud Run

The primary production deployment target is **Google Cloud Run**. The workflow in
`.github/workflows/deploy.yml` builds the Docker image, pushes it to Artifact Registry, and deploys
to Cloud Run in a single pipeline triggered on every push to `main`.

```
main push
  → quality gate (lint + typecheck + test + build)
  → docker build + push to Artifact Registry
  → gcloud run deploy
  → smoke test /api/health
```

**Setup (one-time):**

```bash
# Create Artifact Registry repository
gcloud artifacts repositories create tech-fusion \
  --repository-format=docker --location=us-central1

# Create Secret Manager secrets
gcloud secrets create jwt-secret            --data-file=-  <<< "$JWT_SECRET"
gcloud secrets create supabase-url          --data-file=-  <<< "$SUPABASE_URL"
gcloud secrets create supabase-anon-key     --data-file=-  <<< "$SUPABASE_ANON_KEY"
gcloud secrets create supabase-service-role-key --data-file=- <<< "$SUPABASE_SERVICE_ROLE_KEY"
gcloud secrets create redis-url             --data-file=-  <<< "$REDIS_URL"
gcloud secrets create mqtt-url              --data-file=-  <<< "$MQTT_URL"
gcloud secrets create otel-endpoint        --data-file=-  <<< "$OTEL_ENDPOINT"

# Grant Secret Manager access to the Cloud Run service account
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:tech-fusion-grid-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Required GitHub secrets:**

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | Workload Identity Federation provider |
| `GCP_SERVICE_ACCOUNT` | Deployer service account email |

### Docker health check

The production Dockerfile now includes a native `HEALTHCHECK`:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
```

Cloud Run also uses the `/api/health` liveness and startup probes defined in `cloud-run.yaml`.

### Observability: structured metrics

`lib/telemetry/metrics.ts` exposes an `appMetrics` singleton built on the OTel Metrics API:

| Instrument | Type | Attributes |
|------------|------|------------|
| `api.latency.ms` | Histogram | `route`, `method`, `status` |
| `telemetry.ingestion.ms` | Histogram | `tenantId` |
| `auth.failures.total` | Counter | `reason`, `route` |
| `ratelimit.events.total` | Counter | `ip` |
| `execution.events.total` | Counter | `type`, `tenantId` |
| `telemetry.ingested.total` | Counter | `tenantId` |
| `mqtt.connection.state` | Gauge | `state` (1=connected / 0=reconnecting / -1=disconnected) |

### Correlation IDs

All API responses automatically include an `X-Correlation-ID` header. Wrap your handler with
`withCorrelationId` to propagate or generate the ID:

```typescript
export const GET = toNextRoute(
  withCorrelationId(withErrorHandler(withAuth(handler))),
);
```

### Session revocation

Tokens can be invalidated before natural expiry using the Redis-backed denylist:

```typescript
import { revokeToken, isTokenRevoked } from "@/lib/auth";

// On logout or security event
await revokeToken(accessToken);

// In middleware (called automatically by withAuth when REDIS_URL is set)
const revoked = await isTokenRevoked(token);
```

Revoked entries expire from Redis after `TOKEN_REVOCATION_TTL` seconds (default: 900 = 15 min).

### Reliability utilities

| Module | Purpose |
|--------|---------|
| `lib/utils/retry.ts` | `retry(fn, { maxAttempts, baseDelayMs, jitter })` — exponential backoff with jitter |
| `lib/utils/circuit-breaker.ts` | `CircuitBreaker` class — CLOSED/OPEN/HALF_OPEN state machine |
| `lib/utils/shutdown.ts` | `onShutdown(name, fn)` — SIGTERM/SIGINT graceful shutdown with timeout |
| `lib/utils/idempotency.ts` | `withIdempotency(key, tenantId, fn)` — Redis-backed idempotency for execution actions |

Graceful shutdown is registered in `instrumentation.ts` and calls `redis.quit()` and
`mqttClient.disconnect()` on SIGTERM.

### MQTT production hardening

For production deployment:

1. Copy `mosquitto-config/mosquitto.production.example.conf` → `mosquitto.conf`
2. Set `allow_anonymous false`
3. Generate server certificates and set `cafile`, `certfile`, `keyfile`
4. Create a password file with `mosquitto_passwd`
5. Create an ACL file restricting each client to `telemetry/{clientId}/#` and `commands/{clientId}/#`

See `mosquitto-config/mosquitto.production.example.conf` for the full template.

### Updated production checklist

- [x] Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [x] Set `JWT_SECRET` to a cryptographically random string ≥ 32 chars
- [x] Run database migrations `001_init.sql` then `002_rls.sql`
- [x] Configure Supabase JWT secret to match `JWT_SECRET` to activate RLS policies
- [x] Enable Row Level Security (RLS) policies applied by `002_rls.sql`
- [x] Redis-backed rate limiter (automatic when `REDIS_URL` is set)
- [x] Token revocation via Redis denylist (automatic when `REDIS_URL` is set)
- [x] Cloud Run deployment workflow and `cloud-run.yaml` service configuration
- [x] Docker HEALTHCHECK pointing to `/api/health`
- [x] Structured metrics with OTel (api latency, auth failures, rate-limit events, MQTT state)
- [x] Correlation IDs on all API responses (`X-Correlation-ID` header)
- [x] Graceful shutdown handlers (SIGTERM → redis.quit + mqtt.disconnect)
- [ ] Configure MQTT broker with TLS + ACL rules (template provided)
- [ ] Set `REDIS_URL` to a production Redis instance (TLS recommended: `rediss://`)
- [ ] Configure `OTEL_EXPORTER_OTLP_ENDPOINT` for production tracing
- [ ] Set up log aggregation consuming the JSON log output
- [ ] Configure Workload Identity Federation for keyless Cloud Run deployment
- [ ] Set Playwright smoke tests to run against staging environment

## Operational runbook

### Health check

```bash
curl -sf https://your-service.run.app/api/health | python3 -m json.tool
```

Expected output when healthy:
```json
{ "status": "ok", "dependencies": { "mqtt": "ok", "supabase": "ok", "redis": "ok" } }
```

| `status` | Meaning | HTTP code |
|----------|---------|-----------|
| `ok` | All dependencies healthy | 200 |
| `degraded` | At least one dependency degraded | 200 |
| `down` | At least one dependency unreachable | 503 |

### Force token revocation

```bash
# Revoke a specific token (from a serverless job or admin tool)
node -e "
  process.env.REDIS_URL = process.env.REDIS_URL;
  process.env.JWT_SECRET = process.env.JWT_SECRET;
  const { revokeToken } = require('./lib/auth');
  revokeToken(process.argv[1]).then(() => console.log('revoked')).catch(console.error);
" -- TOKEN_VALUE
```

### Circuit breaker state check

Import `CircuitBreaker` from `lib/utils/circuit-breaker.ts` and call `breaker.getSnapshot()` from
a `/api/debug/circuit-breakers` admin route (restrict to `service` role).

### Log querying (Cloud Logging)

```bash
# Error logs in the last hour
gcloud logging read \
  'resource.type="cloud_run_revision" severity=ERROR' \
  --limit=50 --freshness=1h
```
