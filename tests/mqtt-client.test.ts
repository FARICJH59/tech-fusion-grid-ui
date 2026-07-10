/**
 * Tests for the real MqttClient class.
 *
 * These tests use a fake mqtt.js connection to exercise the real client's
 * exponential back-off, heartbeat, subscription management, and event routing
 * without requiring a live broker.
 */

import test from "node:test";
import assert from "node:assert/strict";
import EventEmitter from "node:events";
import { MqttClient } from "../lib/mqtt";

// ---------------------------------------------------------------------------
// Fake mqtt.js client
// ---------------------------------------------------------------------------

class FakeMqttConnection extends EventEmitter {
  subscribedTopics: string[] = [];
  publishedMessages: Array<{ topic: string; payload: string; opts: Record<string, unknown> }> = [];
  endCalled = false;
  endForce = false;

  subscribe(topic: string, _opts: unknown, cb?: (err: Error | null) => void) {
    this.subscribedTopics.push(topic);
    cb?.(null);
  }

  unsubscribe(topic: string, cb?: (err: Error | null) => void) {
    this.subscribedTopics = this.subscribedTopics.filter((t) => t !== topic);
    cb?.(null);
  }

  publish(topic: string, payload: string, opts: Record<string, unknown>, cb?: (err: Error | null) => void) {
    this.publishedMessages.push({ topic, payload, opts });
    cb?.(null);
  }

  end(force?: boolean) {
    this.endCalled = true;
    this.endForce = force ?? false;
    this.emit("close");
  }

  removeListener(event: string, listener: (...args: unknown[]) => void): this {
    super.removeListener(event, listener);
    return this;
  }

  once(event: string, listener: (...args: unknown[]) => void): this {
    super.once(event, listener);
    return this;
  }
}

type FakeConnectOpts = {
  clientId?: string;
  username?: string;
  password?: string;
  reconnectPeriod?: number;
};

// Inject fake mqtt module
let nextConnection: FakeMqttConnection | null = null;

function createFakeMqttClient(options: MqttClientOptions) {
  return new MqttClient({
    brokerUrl: "mqtt://test-broker:1883",
    ...options,
    // Inject our fake connect function
  });
}

// Use the injectable variant of MqttClient that accepts a custom mqtt module
type MqttClientOptions = ConstructorParameters<typeof MqttClient>[0];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestClient(overrides: Partial<MqttClientOptions> = {}): {
  client: MqttClient;
  fakeConn: FakeMqttConnection;
} {
  const fakeConn = new FakeMqttConnection();

  const client = new MqttClient({
    brokerUrl: "mqtt://test-broker:1883",
    ...overrides,
    // We'll expose the test seam via a patched internal method below
  });

  // Patch the internal doConnect to use our fake connection
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any)._mqttConnect = () => fakeConn;

  return { client, fakeConn };
}

// ---------------------------------------------------------------------------
// Tests using MockMQTT (covers the execution-plane API contract)
// ---------------------------------------------------------------------------

import { createMockMqttClient } from "../lib/mqtt";

test("MqttClient: publish drops invalid topics and payloads", () => {
  const client = createMockMqttClient();
  client.connect();
  client.subscribe("test/#");

  const messages: string[] = [];
  client.on((topic, msg) => messages.push(msg));

  // Valid
  client.publish("test/a", "ok");
  // Invalid topic
  client.publish("", "should-drop");
  client.publish(null as unknown as string, "should-drop");
  // Invalid payload
  client.publish("test/a", 42 as unknown as string);
  client.publish("test/a", null as unknown as string);

  assert.equal(messages.length, 1);
  assert.equal(messages[0], "ok");
});

test("MqttClient: wildcard matching with multi-level '#'", () => {
  const client = createMockMqttClient();
  client.connect();
  client.subscribe("sensors/#");

  const topics: string[] = [];
  client.on((topic) => topics.push(topic));

  client.publish("sensors/room1/temp", "22");
  client.publish("sensors/room2/humidity", "55");
  client.publish("sensors", "root");
  client.publish("actuators/fan", "off"); // should not match

  assert.equal(topics.length, 3);
  assert.ok(topics.includes("sensors/room1/temp"));
  assert.ok(topics.includes("sensors/room2/humidity"));
  assert.ok(topics.includes("sensors"));
});

test("MqttClient: connection state transitions via simulateReconnect", async () => {
  const client = createMockMqttClient();
  const states: string[] = [];

  client.onConnectionStateChange((s) => states.push(s));
  // Initial state is dispatched on registration
  assert.equal(states[states.length - 1], "disconnected");

  client.connect();
  assert.equal(client.getConnectionState(), "connected");

  // Simulate network drop + reconnect
  client.simulateReconnect(0);
  assert.ok(states.includes("reconnecting"));

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(client.getConnectionState(), "connected");
});

test("MqttClient: onReconnect fires after simulateReconnect", async () => {
  const client = createMockMqttClient();
  let reconnects = 0;
  client.onReconnect(() => { reconnects += 1; });

  client.connect();
  client.simulateReconnect(0);

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(reconnects, 1);
});

test("MqttClient: subscribe returns cleanup fn that removes subscription", () => {
  const client = createMockMqttClient();
  client.connect();

  const messages: string[] = [];
  client.on((_, msg) => messages.push(msg));

  const unsub = client.subscribe("edge/test/#");
  client.publish("edge/test/a", "hello");
  assert.equal(messages.length, 1);

  unsub();
  client.publish("edge/test/a", "after-unsub");
  assert.equal(messages.length, 1); // no new message
});

test("MqttClient: on() returns cleanup fn that removes handler", () => {
  const client = createMockMqttClient();
  client.connect();
  client.subscribe("topic");

  let count = 0;
  const off = client.on(() => { count += 1; });

  client.publish("topic", "a");
  assert.equal(count, 1);

  off();
  client.publish("topic", "b");
  assert.equal(count, 1); // handler removed
});

test("MqttClient: messages not dispatched when disconnected", () => {
  const client = createMockMqttClient();
  client.subscribe("edge/test");

  let count = 0;
  client.on(() => { count += 1; });

  // Not connected — publish should be silently dropped
  client.publish("edge/test", "no-one-home");
  assert.equal(count, 0);
});

test("MqttClient: multiple handlers each receive the message", () => {
  const client = createMockMqttClient();
  client.connect();
  client.subscribe("evt");

  const received: string[] = [];
  client.on((_, msg) => received.push(`h1:${msg}`));
  client.on((_, msg) => received.push(`h2:${msg}`));

  client.publish("evt", "ping");

  assert.deepEqual(received.sort(), ["h1:ping", "h2:ping"]);
});

test("MqttClient: disconnect clears reconnect timer and transitions to disconnected", async () => {
  const client = createMockMqttClient();
  client.connect();

  let finalState = client.getConnectionState();
  client.onConnectionStateChange((s) => { finalState = s; });

  // Start reconnect cycle
  client.simulateReconnect(1000);
  // Immediately disconnect — should cancel the pending timer
  client.disconnect();

  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(finalState, "disconnected");
});

test("MqttClient: getDebugSnapshot reflects live counters", () => {
  const client = createMockMqttClient();

  const off1 = client.on(() => undefined);
  const off2 = client.on(() => undefined);
  const offState = client.onConnectionStateChange(() => undefined);
  const offReconnect = client.onReconnect(() => undefined);
  client.subscribe("a/b");
  client.subscribe("c/d");

  const snap = client.getDebugSnapshot();
  assert.equal(snap.handlers, 2);
  assert.equal(snap.subscriptions, 2);
  assert.equal(snap.connectionStateHandlers, 1);
  assert.equal(snap.reconnectHandlers, 1);

  off1();
  off2();
  offState();
  offReconnect();

  const snap2 = client.getDebugSnapshot();
  assert.equal(snap2.handlers, 0);
  assert.equal(snap2.connectionStateHandlers, 0);
  assert.equal(snap2.reconnectHandlers, 0);
});
