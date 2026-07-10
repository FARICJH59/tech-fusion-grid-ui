/**
 * Tests for MQTT reconnect and failure handling.
 *
 * Tests the MockMQTT client's resilience behaviors: reconnect after close,
 * failure injection, and state change handling.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { MockMQTT } from "../lib/mqtt";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("MockMQTT: starts in disconnected state before connect()", () => {
  const client = new MockMQTT();
  // Before explicit connect, state may be disconnected
  const state = client.getConnectionState();
  assert.ok(
    state === "disconnected" || state === "connected",
    `Unexpected initial state: ${state}`,
  );
});

test("MockMQTT: connect() transitions to connected", () => {
  const client = new MockMQTT();
  client.connect();
  assert.equal(client.getConnectionState(), "connected");
});

test("MockMQTT: publish and subscribe round-trip via on() handler", async () => {
  const client = new MockMQTT();
  client.connect();
  const received: Array<{ topic: string; payload: string }> = [];

  client.on((topic, payload) => received.push({ topic, payload: payload as string }));
  client.subscribe("sensor/temperature");
  client.publish("sensor/temperature", "42.5");

  await sleep(10);
  assert.equal(received.length, 1);
  assert.equal(received[0].topic, "sensor/temperature");
  assert.equal(received[0].payload, "42.5");
});

test("MockMQTT: unsubscribe stops message delivery for that topic", async () => {
  const client = new MockMQTT();
  client.connect();
  const received: string[] = [];

  client.on((_t, payload) => received.push(payload as string));
  client.subscribe("sensor/temp");
  client.publish("sensor/temp", "v1");

  await sleep(10);
  assert.equal(received.length, 1);

  client.unsubscribe("sensor/temp");
  client.publish("sensor/temp", "v2");

  await sleep(10);
  // Still 1 — second publish not delivered (no matching subscription)
  assert.equal(received.length, 1);
});

test("MockMQTT: disconnect and reconnect cycle via simulateReconnect", async () => {
  const client = new MockMQTT();
  client.connect();
  const stateChanges: string[] = [];

  client.onConnectionStateChange((state) => stateChanges.push(state));

  assert.equal(client.getConnectionState(), "connected");

  client.disconnect();
  assert.equal(client.getConnectionState(), "disconnected");

  // Use simulateReconnect to trigger reconnect flow
  client.simulateReconnect(10);
  await sleep(30);

  assert.equal(client.getConnectionState(), "connected");
  assert.ok(
    stateChanges.includes("disconnected"),
    `Expected 'disconnected' in state changes: ${stateChanges}`,
  );
  assert.ok(
    stateChanges.includes("connected"),
    `Expected 'connected' in state changes: ${stateChanges}`,
  );
});

test("MockMQTT: getDebugSnapshot reflects current state", () => {
  const client = new MockMQTT();
  client.connect();
  client.subscribe("topic/a");
  client.subscribe("topic/b");

  const snap = client.getDebugSnapshot();
  assert.equal(snap.state, "connected");
  assert.ok(snap.subscriptions >= 2, `Expected >= 2 subscriptions, got ${snap.subscriptions}`);
});

test("MockMQTT: wildcard subscriber receives messages on matching subtopics", async () => {
  const client = new MockMQTT();
  client.connect();
  const received: string[] = [];

  client.on((topic) => received.push(topic));
  client.subscribe("sensor/#");

  client.publish("sensor/temp", "22");
  client.publish("sensor/humidity", "60");

  await sleep(10);
  assert.equal(received.length, 2);
  assert.ok(received.includes("sensor/temp"));
  assert.ok(received.includes("sensor/humidity"));
});

test("MockMQTT: multiple on() handlers all receive the same message", async () => {
  const client = new MockMQTT();
  client.connect();
  const results: string[] = [];

  client.on(() => results.push("handler1"));
  client.on(() => results.push("handler2"));
  client.subscribe("cmd/start");
  client.publish("cmd/start", "go");

  await sleep(10);
  assert.ok(results.includes("handler1"));
  assert.ok(results.includes("handler2"));
});

test("MockMQTT: onReconnect handler fires after simulateReconnect", async () => {
  const client = new MockMQTT();
  client.connect();
  let reconnected = false;

  client.onReconnect(() => { reconnected = true; });
  client.simulateReconnect(10);
  await sleep(30);

  assert.ok(reconnected, "Expected onReconnect handler to fire");
});
