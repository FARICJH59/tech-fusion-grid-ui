import test from "node:test";
import assert from "node:assert/strict";
import Redis from "ioredis";
import mqtt from "mqtt";

const redisUrl = process.env.REDIS_URL;
const mqttUrl = process.env.MQTT_URL;

const requireEnv = (name: string, value: string | undefined): string => {
  if (!value) throw new Error(`${name} is required for real-services integration tests`);
  return value;
};

test("real Redis accepts and returns a transaction-shaped record", async (t) => {
  const url = requireEnv("REDIS_URL", redisUrl);
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
  const key = `hoare:integration:${process.pid}:${Date.now()}`;
  const value = JSON.stringify({ transactionId: key, state: "RUNNING", stateVersion: 1 });

  t.after(() => client.disconnect());

  await client.connect();
  assert.equal(await client.ping(), "PONG");
  await client.set(key, value, "EX", 30);
  assert.equal(await client.get(key), value);
  assert.equal(await client.del(key), 1);
});

test("real Mosquitto completes an MQTT publish/subscribe round trip", async (t) => {
  const url = requireEnv("MQTT_URL", mqttUrl);
  const suffix = `${process.pid}-${Date.now()}`;
  const topic = `hoare/integration/${suffix}`;
  const payload = JSON.stringify({ transactionId: `tx-${suffix}`, attemptId: `attempt-${suffix}` });

  const client = mqtt.connect(url, { reconnectPeriod: 0, connectTimeout: 5000 });
  t.after(() => client.end(true));

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("MQTT connection timeout")), 7000);
    client.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    client.once("error", reject);
  });

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("MQTT round-trip timeout")), 7000);
    client.subscribe(topic, { qos: 1 }, (subscribeError) => {
      if (subscribeError) {
        clearTimeout(timer);
        reject(subscribeError);
        return;
      }
      client.once("message", (receivedTopic, message) => {
        clearTimeout(timer);
        try {
          assert.equal(receivedTopic, topic);
          assert.equal(message.toString("utf8"), payload);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      client.publish(topic, payload, { qos: 1 }, (publishError) => {
        if (publishError) {
          clearTimeout(timer);
          reject(publishError);
        }
      });
    });
  });
});
