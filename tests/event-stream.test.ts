import test from "node:test";
import assert from "node:assert/strict";

import { AutonomousEventBus } from "../lib/events/event-bus";
import { StreamProcessor } from "../lib/events/stream-processor";

function baseEvent(id: string) {
  return {
    id,
    tenantId: "tenant-1",
    organizationId: "org-1",
    type: "deployment" as const,
    source: "test",
    priority: "medium" as const,
    timestamp: new Date().toISOString(),
    dedupeKey: id,
    payload: { service: "api" },
  };
}

test("event bus supports replay and idempotency", async () => {
  const bus = new AutonomousEventBus("phase85:test:stream", "phase85:test:dlq");
  const first = await bus.publish(baseEvent("evt-1"));
  const duplicate = await bus.publish(baseEvent("evt-1"));

  assert.equal(first, true);
  assert.equal(duplicate, false);

  const replay = await bus.replay({ tenantId: "tenant-1", organizationId: "org-1", limit: 10 });
  assert.equal(replay.length, 1);
  assert.equal(replay[0].id, "evt-1");
});

test("stream processor handles retries and dead-letter routing", async () => {
  const bus = new AutonomousEventBus("phase85:test:stream-processor", "phase85:test:dlq-processor");
  const processor = new StreamProcessor(bus);

  processor.register("deployment", async (event) => {
    if ((event.attempts ?? 0) >= 2) {
      throw new Error("terminal");
    }
  });

  const result = await processor.processBatch([
    { ...baseEvent("evt-2"), attempts: 2 },
    { ...baseEvent("evt-3"), attempts: 0 },
  ]);

  assert.equal(result.deadLettered, 1);
  assert.equal(result.processed, 1);
  assert.equal(result.retried, 0);
});
