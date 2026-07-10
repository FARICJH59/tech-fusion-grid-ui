# HOARE Runtime Reference

## RuntimeManager lifecycle

`RuntimeManager` is the central lifecycle coordinator.

1. Construct manager with optional plugins.
2. `start()` transitions `stopped -> starting -> running`.
3. Plugins load during startup using a system runtime context.
4. Shutdown hooks register through `onShutdown()` / `registerShutdownHooks()`.
5. `stop()` drains queued executions, unloads plugins, and transitions to `stopped`.

The singleton `hoareRuntime` is intended for in-app use.

## Registry APIs

### AgentRegistry

- `register(def)` — adds a unique agent id.
- `deregister(id)` — removes an agent.
- `get(id)` — fetches one definition.
- `list(tenantId?)` — returns all or tenant-visible agents.
- `count()` — total registered agents.

### ToolRegistry

- `register(def)` — stores a versioned tool.
- `get(id, version?)` — returns a requested version or latest known version.
- `listVersions(id)` — returns sorted versions for a tool id.
- `deregister(id, version?)` — removes one or all versions.
- `count()` — total registered tool versions.

### WorkflowRegistry

- `register(def)` / `deregister(id)`
- `get(id)`
- `list(tenantId?)`
- `count()`

## Execution Engine behavior

`ExecutionEngine.execute()` handles:

- `execution.started` / `execution.completed` / `execution.failed` events
- idempotency via `withIdempotency()` plus in-memory replay cache
- retries via `retry()` with exponential backoff
- timeouts via `Promise.race()`
- dead-letter writes via `deadLetter()` after terminal failure

`executeWorkflow()` runs workflow steps sequentially, resolves tools from the registry, honors per-step retry and timeout settings, and supports `onError` policies:

- `stop` — halt and fail the workflow
- `continue` — record the failed step and continue
- `dead-letter` — dead-letter the failed step and continue

## Event Bus API

`InMemoryEventBus` implements:

- `emit(event)` — dispatch to exact-match handlers, then wildcard handlers
- `on(type, handler)` — subscribe and receive an unsubscribe function
- `off(type, handler)` — explicit unsubscription
- `onceAsync(type)` — await the next event of a specific type

Handler failures are logged and never propagated to emitters.

## Plugin loading

`PluginLoader` tracks loaded plugins by id.

- `load(plugin, ctx)` initializes and stores the plugin
- `unloadAll()` tears plugins down in reverse order
- `list()` and `get(id)` expose the active plugin set

## Next.js integration

- `instrumentation.ts` initializes telemetry and graceful shutdown hooks during Node.js startup.
- `RuntimeManager.start()` also registers shutdown handling, making runtime startup safe from API routes or other server-only entry points.
- `app/api/runtime/status/route.ts` exposes operator-facing runtime state for diagnostics.
