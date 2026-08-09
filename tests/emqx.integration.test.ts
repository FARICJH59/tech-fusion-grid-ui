import test from "node:test";
import assert from "node:assert/strict";
import mqtt from "mqtt";

const enabled = process.env.EMQX_INTEGRATION === "true";
const brokerUrl = process.env.MQTT_URL;
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;
const ca = process.env.MQTT_CA_CERT;
const cert = process.env.MQTT_CLIENT_CERT;
const key = process.env.MQTT_CLIENT_KEY;
const tenant = process.env.MQTT_TEST_TENANT;
const otherTenant = process.env.MQTT_TEST_OTHER_TENANT;
const baseTopic = process.env.MQTT_TEST_TOPIC;

const missing = [
  ["MQTT_URL", brokerUrl],
  ["MQTT_TEST_TENANT", tenant],
  ["MQTT_TEST_OTHER_TENANT", otherTenant],
  ["MQTT_TEST_TOPIC", baseTopic],
].filter(([, value]) => !value).map(([name]) => name);

const integrationReady = enabled && missing.length === 0;

const testIfReady = integrationReady ? test : test.skip;

const clientOptions = (clientId: string): mqtt.IClientOptions => ({
  clientId,
  clean: true,
  connectTimeout: 5_000,
  keepalive: 15,
  reconnectPeriod: 0,
  username,
  password,
  ca: ca ? [Buffer.from(ca)] : undefined,
  cert: cert ? Buffer.from(cert) : undefined,
  key: key ? Buffer.from(key) : undefined,
  rejectUnauthorized: true,
});

function connectClient(clientId: string): Promise<mqtt.MqttClient> {
  assert.ok(brokerUrl, "MQTT_URL must be configured");
  return new Promise((resolve, reject) => {
    const client = mqtt.connect(brokerUrl, clientOptions(clientId));
    const timer = setTimeout(() => {
      client.end(true);
      reject(new Error(`Timed out connecting to EMQX as ${clientId}`));
    }, 8_000);

    client.once("connect", () => {
      clearTimeout(timer);
      resolve(client);
    });
    client.once("error", (error) => {
      clearTimeout(timer);
      client.end(true);
      reject(error);
    });
  });
}

function closeClient(client: mqtt.MqttClient | undefined) {
  if (!client) return Promise.resolve();
  return new Promise<void>((resolve) => client.end(true, {}, () => resolve()));
}

function uniqueTopic(scope: string) {
  return `${baseTopic!.replace(/\/$/, "")}/${scope}/${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function subscribeOnce(client: mqtt.MqttClient, topic: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for MQTT message on ${topic}`)), 8_000);
    client.subscribe(topic, { qos: 1 }, (error) => {
      if (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
    client.once("message", (receivedTopic, payload) => {
      if (receivedTopic !== topic) return;
      clearTimeout(timer);
      resolve(payload.toString("utf8"));
    });
  });
}

function publish(client: mqtt.MqttClient, topic: string, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1 }, (error) => error ? reject(error) : resolve());
  });
}

testIfReady("EMQX integration: TLS/authenticated connection succeeds", async () => {
  const client = await connectClient(`hoare-emqx-health-${Date.now()}`);
  try {
    assert.equal(client.connected, true);
  } finally {
    await closeClient(client);
  }
});

testIfReady("EMQX integration: authorized tenant publish reaches subscriber", async () => {
  const subscriber = await connectClient(`hoare-emqx-sub-${Date.now()}`);
  const publisher = await connectClient(`hoare-emqx-pub-${Date.now()}`);
  const topic = uniqueTopic(tenant!);
  const payload = JSON.stringify({
    type: "shelf.observation",
    tenantId: tenant,
    productId: "integration-test-product",
    confidence: 0.99,
  });

  try {
    const received = subscribeOnce(subscriber, topic);
    await new Promise<void>((resolve, reject) => {
      subscriber.subscribe(topic, { qos: 1 }, (error) => error ? reject(error) : resolve());
    });
    await publish(publisher, topic, payload);
    assert.equal(await received, payload);
  } finally {
    await Promise.all([closeClient(publisher), closeClient(subscriber)]);
  }
});

testIfReady("EMQX integration: cross-tenant publish is denied by broker ACL", async () => {
  const publisher = await connectClient(`hoare-emqx-deny-${Date.now()}`);
  const topic = uniqueTopic(otherTenant!);

  try {
    await assert.rejects(
      publish(publisher, topic, JSON.stringify({
        type: "shelf.observation",
        tenantId: tenant,
        unauthorized: true,
      })),
      /not authorized|not authorised|authorization|authorisation|acl|closed|disconnect/i,
    );
  } finally {
    await closeClient(publisher);
  }
});

if (!enabled) {
  console.info("[EMQX INTEGRATION] skipped: set EMQX_INTEGRATION=true to enable the live broker gate");
} else if (missing.length > 0) {
  console.info(`[EMQX INTEGRATION] skipped: missing ${missing.join(", ")}`);
}
