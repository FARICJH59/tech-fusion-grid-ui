import test from "node:test";
import assert from "node:assert/strict";
import { createMockMqttClient } from "../lib/mqtt";

test("dispatches only to matching wildcard subscriptions", () => {
  const client = createMockMqttClient();
  const seen: Array<{ topic: string; message: string }> = [];

  client.connect();
  client.subscribe("edge/inverters/#");
  client.on((topic, message) => {
    seen.push({ topic, message });
  });

  client.publish("edge/inverters/a", "ok");
  client.publish("edge/faults", "ignored");

  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], { topic: "edge/inverters/a", message: "ok" });
});

test("supports reconnect callbacks and updates connection state", async () => {
  const client = createMockMqttClient();
  const states: string[] = [];
  let reconnectCount = 0;

  client.onConnectionStateChange((state) => {
    states.push(state);
  });
  client.onReconnect(() => {
    reconnectCount += 1;
  });

  client.connect();
  client.simulateReconnect(0);
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.equal(client.getConnectionState(), "connected");
  assert.equal(reconnectCount, 1);
  assert.ok(states.includes("reconnecting"));
  assert.ok(states.includes("connected"));
});

test("drops malformed publish payloads without invoking listeners", () => {
  const client = createMockMqttClient();
  let hits = 0;

  client.connect();
  client.subscribe("edge/inverters/#");
  client.on(() => {
    hits += 1;
  });

  client.publish("edge/inverters/a", { invalid: true });
  client.publish("", "bad-topic");
  client.publish("edge/inverters/a", "valid");

  assert.equal(hits, 1);
});

test("does not leak listeners after repeated subscribe/unsubscribe cycles", () => {
  const client = createMockMqttClient();

  for (let i = 0; i < 50; i += 1) {
    const offMessage = client.on(() => undefined);
    const offState = client.onConnectionStateChange(() => undefined);
    const offReconnect = client.onReconnect(() => undefined);
    const offSubscription = client.subscribe("edge/inverters/#");

    offMessage();
    offState();
    offReconnect();
    offSubscription();
  }

  const snapshot = client.getDebugSnapshot();
  assert.equal(snapshot.handlers, 0);
  assert.equal(snapshot.subscriptions, 0);
  assert.equal(snapshot.connectionStateHandlers, 0);
  assert.equal(snapshot.reconnectHandlers, 0);
});
