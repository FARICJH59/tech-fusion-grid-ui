# HOARE.ai Architecture

## Layered architecture

```text
Tech-Fusion-Grid-UI (Energy/Grid Application)
↓ HOARE SDK (@hoare/sdk)
↓ HOARE.ai Control Plane
↓ HOARE Runtime (lib/runtime/)
↓ HOARE-Agent (autonomous agent runtime)
↓ AI Provider Gateway (lib/providers/)
↓ Infrastructure (Cloud Run, Redis, PostgreSQL, EMQX, OTel)
```

## Layer descriptions and boundaries

1. **Tech-Fusion-Grid-UI** hosts the domain UX, API routes, and operational dashboards.
2. **HOARE SDK** provides typed control-plane clients for auth, runtime, workflow, agent, telemetry, deployment, billing, and audit calls.
3. **HOARE.ai Control Plane** owns tenancy, policy, orchestration APIs, and management workflows.
4. **HOARE Runtime** hosts registries, execution queueing, eventing, plugins, and deterministic execution behavior.
5. **HOARE-Agent** executes autonomous agent logic on top of runtime context and tool access.
6. **AI Provider Gateway** normalizes model completions across OpenAI, Anthropic, and Gemini.
7. **Infrastructure** supplies persistence, messaging, observability, and deployment primitives.

Each layer only talks to the next layer through typed contracts. UI code should not call provider APIs directly, and agents/tools should not depend on framework-only request objects.

## Module map

- `app/api/runtime/status/route.ts` — runtime status surface for operators.
- `lib/runtime/` — runtime types, context, registries, queue, event bus, execution engine, plugins, manager.
- `lib/providers/` — provider contracts, concrete provider adapters, failover gateway.
- `lib/sdk/` — fetch-based enterprise SDK clients and shared request/response types.
- `lib/utils/` — retry, idempotency, dead-letter, shutdown, Redis, MQTT, auth, telemetry primitives reused by runtime.
- `instrumentation.ts` — startup hooks for telemetry and graceful shutdown integration.

## Tenant isolation model

- Every execution request, workflow run, SDK client, and runtime event carries a `tenantId`.
- Agent and workflow registries support global definitions (`tenantId` undefined) plus tenant-scoped definitions.
- Idempotency keys are namespaced by tenant.
- Dead-letter entries are partitioned by tenant and queue.
- Protected routes derive tenant identity from authenticated JWT claims.

## Event flow

```text
Client / UI
  -> SDK client or protected API route
  -> RuntimeManager creates RuntimeContext
  -> ExecutionEngine resolves agent/tool/workflow
  -> Retry / timeout / idempotency / DLQ wrappers execute
  -> EventBus emits execution and workflow events
  -> Telemetry + metrics record latency and execution counters
  -> Provider Gateway or infrastructure dependencies handle downstream work
```
