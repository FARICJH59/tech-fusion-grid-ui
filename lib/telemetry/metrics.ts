/**
 * Structured application metrics built on top of the OpenTelemetry Metrics API.
 *
 * All instruments are lazily initialised so they are safe to import in test
 * environments where the OTel SDK is not started.  When the SDK has not been
 * initialised the default no-op meter is used and all recordings are silently
 * dropped.
 *
 * Usage:
 *   import { metrics } from "@/lib/telemetry/metrics";
 *   metrics.apiLatency.record(durationMs, { route: "/api/telemetry", method: "GET", status: "200" });
 */

import { getMeter } from "@/lib/telemetry/otel";

// ---------------------------------------------------------------------------
// Instrument definitions
// ---------------------------------------------------------------------------

let _initialized = false;

// Histograms
let _apiLatencyMs: ReturnType<ReturnType<typeof getMeter>["createHistogram"]>;
let _telemetryIngestionMs: ReturnType<ReturnType<typeof getMeter>["createHistogram"]>;

// Counters
let _authFailures: ReturnType<ReturnType<typeof getMeter>["createCounter"]>;
let _rateLimitEvents: ReturnType<ReturnType<typeof getMeter>["createCounter"]>;
let _executionPlaneEvents: ReturnType<ReturnType<typeof getMeter>["createCounter"]>;
let _telemetryIngested: ReturnType<ReturnType<typeof getMeter>["createCounter"]>;

// Observable gauges (up/down values)
let _mqttConnectionState: ReturnType<ReturnType<typeof getMeter>["createObservableGauge"]>;

function ensureInitialized(): void {
  if (_initialized) return;
  _initialized = true;

  const meter = getMeter();

  _apiLatencyMs = meter.createHistogram("api.latency.ms", {
    description: "End-to-end API handler latency in milliseconds",
    unit: "ms",
    advice: { explicitBucketBoundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000] },
  });

  _telemetryIngestionMs = meter.createHistogram("telemetry.ingestion.ms", {
    description: "Time to ingest a telemetry record end-to-end in milliseconds",
    unit: "ms",
    advice: { explicitBucketBoundaries: [1, 5, 10, 25, 50, 100, 250, 500] },
  });

  _authFailures = meter.createCounter("auth.failures.total", {
    description: "Total authentication and authorisation failures",
  });

  _rateLimitEvents = meter.createCounter("ratelimit.events.total", {
    description: "Total rate-limit rejections issued to clients",
  });

  _executionPlaneEvents = meter.createCounter("execution.events.total", {
    description: "Total execution-plane events dispatched (commands, state changes)",
  });

  _telemetryIngested = meter.createCounter("telemetry.ingested.total", {
    description: "Total telemetry records ingested",
  });

  _mqttConnectionState = meter.createObservableGauge("mqtt.connection.state", {
    description: "MQTT broker connection state: 1=connected, 0=reconnecting, -1=disconnected",
  });

  // Report MQTT state on every collection cycle
  _mqttConnectionState.addCallback((result) => {
    try {
      // eslint-disable-next-line
      const mod = require("@/lib/mqtt") as { mqttClient: { getConnectionState(): string } };
      const mqttState: string = mod.mqttClient.getConnectionState();
      const value = mqttState === "connected" ? 1 : mqttState === "reconnecting" ? 0 : -1;
      result.observe(value, { state: mqttState });
    } catch {
      result.observe(-1, { state: "unknown" });
    }
  });
}

// ---------------------------------------------------------------------------
// Public API — thin wrappers that lazy-init and delegate to OTel instruments
// ---------------------------------------------------------------------------

export const appMetrics = {
  /** Record API handler latency.  Call at the end of each request. */
  recordApiLatency(
    durationMs: number,
    attrs: { route: string; method: string; status: string },
  ): void {
    ensureInitialized();
    _apiLatencyMs.record(durationMs, attrs);
  },

  /** Record telemetry ingestion latency. */
  recordIngestionLatency(durationMs: number, attrs: { tenantId: string }): void {
    ensureInitialized();
    _telemetryIngestionMs.record(durationMs, attrs);
  },

  /** Increment authentication failure counter. */
  incrementAuthFailure(attrs: { reason: "invalid_token" | "expired" | "forbidden"; route: string }): void {
    ensureInitialized();
    _authFailures.add(1, attrs);
  },

  /** Increment rate-limit event counter. */
  incrementRateLimit(attrs: { ip?: string }): void {
    ensureInitialized();
    _rateLimitEvents.add(1, attrs);
  },

  /** Increment execution-plane event counter. */
  incrementExecutionEvent(attrs: { type: string; tenantId: string }): void {
    ensureInitialized();
    _executionPlaneEvents.add(1, attrs);
  },

  /** Increment ingested telemetry records counter. */
  incrementTelemetryIngested(count: number, attrs: { tenantId: string }): void {
    ensureInitialized();
    _telemetryIngested.add(count, attrs);
  },
};

// ---------------------------------------------------------------------------
// Middleware helper — records API latency and sets correlation IDs
// ---------------------------------------------------------------------------

export function measureLatency<T>(
  route: string,
  method: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  return fn().then(
    (result) => {
      appMetrics.recordApiLatency(Date.now() - start, { route, method, status: "success" });
      return result;
    },
    (err: unknown) => {
      appMetrics.recordApiLatency(Date.now() - start, { route, method, status: "error" });
      throw err;
    },
  );
}
