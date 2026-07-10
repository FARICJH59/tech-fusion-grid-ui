import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryEventBus } from "../lib/runtime/event-bus";

test("event-bus: emits event to registered handler", async () => {
  const bus = new InMemoryEventBus();
  let received = false;

  bus.on("execution.started", (event) => {
    received = event.payload.ok === true;
  });

  bus.emit({
    type: "execution.started",
    tenantId: "tenant-a",
    timestamp: new Date().toISOString(),
    payload: { ok: true },
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(received, true);
});

test("event-bus: wildcard handler receives all events", async () => {
  const bus = new InMemoryEventBus();
  const seen: string[] = [];
  bus.on("*", (event) => {
    seen.push(event.type);
  });

  bus.emit({ type: "execution.started", tenantId: "t", timestamp: new Date().toISOString(), payload: {} });
  bus.emit({ type: "execution.completed", tenantId: "t", timestamp: new Date().toISOString(), payload: {} });

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(seen, ["execution.started", "execution.completed"]);
});

test("event-bus: unsubscribe removes handler", async () => {
  const bus = new InMemoryEventBus();
  let calls = 0;
  const unsubscribe = bus.on("execution.started", () => {
    calls += 1;
  });

  unsubscribe();
  bus.emit({ type: "execution.started", tenantId: "t", timestamp: new Date().toISOString(), payload: {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 0);
});

test("event-bus: onceAsync resolves on next matching event", async () => {
  const bus = new InMemoryEventBus();
  const pending = bus.onceAsync("execution.completed");

  bus.emit({
    type: "execution.completed",
    tenantId: "tenant-a",
    correlationId: "corr-a",
    timestamp: new Date().toISOString(),
    payload: { id: 1 },
  });

  const event = await pending;
  assert.equal(event.correlationId, "corr-a");
  assert.deepEqual(event.payload, { id: 1 });
});

test("event-bus: multiple handlers each receive the event", async () => {
  const bus = new InMemoryEventBus();
  let first = 0;
  let second = 0;

  bus.on("execution.started", () => {
    first += 1;
  });
  bus.on("execution.started", () => {
    second += 1;
  });

  bus.emit({ type: "execution.started", tenantId: "t", timestamp: new Date().toISOString(), payload: {} });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(first, 1);
  assert.equal(second, 1);
});

test("event-bus: handler errors do not propagate to emitter", async () => {
  const bus = new InMemoryEventBus();
  bus.on("execution.started", () => {
    throw new Error("boom");
  });

  assert.doesNotThrow(() => {
    bus.emit({ type: "execution.started", tenantId: "t", timestamp: new Date().toISOString(), payload: {} });
  });
});
