/**
 * OpenTelemetry instrumentation bootstrap.
 *
 * Import this module as early as possible (e.g. in instrumentation.ts) so
 * traces and metrics are captured before any other code runs.
 *
 * When OTEL_EXPORTER_OTLP_ENDPOINT is not set the SDK runs in no-op mode so
 * there is zero overhead in development.
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { trace, metrics, type Tracer, type Meter } from "@opentelemetry/api";

const SERVICE_NAME =
  process.env.OTEL_SERVICE_NAME ?? process.env.npm_package_name ?? "tech-fusion-grid-ui";

const SERVICE_VERSION = process.env.npm_package_version ?? "0.0.0";

// ---------------------------------------------------------------------------
// SDK initialisation
// ---------------------------------------------------------------------------

let _sdk: NodeSDK | null = null;

export function initTelemetry(): void {
  if (_sdk) return;

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  const resource = resourceFromAttributes({
    "service.name": SERVICE_NAME,
    "service.version": SERVICE_VERSION,
    "deployment.environment": process.env.NODE_ENV ?? "development",
  });

  const instrumentations = [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ];

  // NodeSDK and OTLPTraceExporter may ship different versions of sdk-trace-base
  // internally, causing a structural type mismatch that is safe at runtime.
  // We construct the SDK with a minimal config and assign traceExporter via
  // a type-erased object spread to avoid the incompatible sub-package types.
  const sdkOptions: ConstructorParameters<typeof NodeSDK>[0] = { resource, instrumentations };
  if (endpoint) {
    (sdkOptions as Record<string, unknown>).traceExporter = new OTLPTraceExporter({ url: endpoint });
  }

  _sdk = new NodeSDK(sdkOptions);

  _sdk.start();

  process.on("SIGTERM", () => {
    _sdk
      ?.shutdown()
      .catch((err: Error) => console.error("[otel] Shutdown error", err.message))
      .finally(() => process.exit(0));
  });

  if (endpoint) {
    console.info(`[otel] Tracing enabled → ${endpoint}`);
  }
}

// ---------------------------------------------------------------------------
// Convenience accessors
// ---------------------------------------------------------------------------

export function getTracer(name = SERVICE_NAME): Tracer {
  return trace.getTracer(name, SERVICE_VERSION);
}

export function getMeter(name = SERVICE_NAME): Meter {
  return metrics.getMeter(name, SERVICE_VERSION);
}

// ---------------------------------------------------------------------------
// Structured logger (wraps console with JSON output in production)
// ---------------------------------------------------------------------------

type LogLevel = "debug" | "info" | "warn" | "error";

type LogRecord = {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  [key: string]: unknown;
};

function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}): void {
  if (process.env.NODE_ENV === "production") {
    const record: LogRecord = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: SERVICE_NAME,
      ...fields,
    };
    process.stdout.write(JSON.stringify(record) + "\n");
  } else {
    const prefix = `[${SERVICE_NAME}] [${level.toUpperCase()}]`;
    const extra = Object.keys(fields).length ? ` ${JSON.stringify(fields)}` : "";
    console[level === "debug" ? "debug" : level === "info" ? "info" : level](`${prefix} ${message}${extra}`);
  }
}

export const logger = {
  debug: (message: string, fields?: Record<string, unknown>) => log("debug", message, fields),
  info: (message: string, fields?: Record<string, unknown>) => log("info", message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => log("warn", message, fields),
  error: (message: string, fields?: Record<string, unknown>) => log("error", message, fields),
};
