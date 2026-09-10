import test from "node:test";
import assert from "node:assert/strict";

import { ResourceAwareRouter } from "../lib/enterprise/resource-routing";
import {
  ResourceRoutingAdapter,
} from "../lib/enterprise/resource-routing-adapter";
import {
  ResourceTelemetryRegistry,
  StaticResourceTelemetryProvider,
} from "../lib/enterprise/resource-telemetry";

const observation = (region: string, latencyMs: number) => ({
  region,
  healthy: true,
  edgeEnabled: region === "edge-local",
  estimatedLatencyMs: latencyMs,
  quotaRemaining: 100,
  energyWh: 1,
  carbonGramsCo2e: 2,
  estimatedCostUsd: 0.001,
  capacityUnits: 100,
  observedAt: "2026-09-10T13:41:00Z",
  source: "test-provider",
  confidence: 0.99,
  latencyP95Ms: latencyMs + 20,
  queueDepth: 2,
});

test("telemetry registry validates and replaces observations by source and region", () => {
  const registry = new ResourceTelemetryRegistry();
  registry.ingest(observation("edge-local", 100));
  registry.ingest({ ...observation("edge-local", 80), confidence: 1 });

  const snapshot = registry.snapshot();
  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].estimatedLatencyMs, 80);
  assert.equal(snapshot[0].confidence, 1);
});

test("telemetry registry rejects invalid confidence", () => {
  const registry = new ResourceTelemetryRegistry();

  assert.throws(
    () => registry.ingest({ ...observation("edge-local", 100), confidence: 1.1 }),
    /telemetry_confidence_out_of_range/,
  );
});

test("routing adapter pushes fresh provider telemetry into the router", () => {
  const router = new ResourceAwareRouter([]);
  const adapter = new ResourceRoutingAdapter(router);

  adapter.register(
    new StaticResourceTelemetryProvider([
      observation("cloud-a", 900),
      observation("edge-local", 120),
    ]),
  );

  const route = adapter.route({
    tenantId: "tenant-live-telemetry",
    maxLatencyMs: 500,
    preferEdge: true,
    allowCloud: true,
  });

  assert.equal(route.decision, "ALLOW");
  assert.equal(route.primary, "edge-local");
  assert.equal(adapter.telemetry().length, 2);
  assert.equal(adapter.telemetry()[0].source, "test-provider");
});
