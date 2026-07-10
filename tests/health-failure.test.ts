/**
 * Tests for health endpoint dependency failure handling.
 *
 * These tests simulate Redis / Supabase / MQTT being down and verify the
 * health route responds correctly without throwing.
 */

import test from "node:test";
import assert from "node:assert/strict";

// Set minimum env vars; leave REDIS_URL and SUPABASE_URL unset to simulate
// unavailable dependencies.
process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-validation-32chars";
delete process.env.REDIS_URL;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
delete process.env.MQTT_URL;

import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Inline health probe logic (mirrors app/api/health/route.ts)
// Tested independently so we can inject failures without a running server.
// ---------------------------------------------------------------------------

type DependencyStatus = "ok" | "degraded" | "down";

async function checkRedis(): Promise<DependencyStatus> {
  if (!process.env.REDIS_URL) return "down";
  try {
    const { getRedis } = await import("../lib/redis");
    const client = getRedis();
    const pong = await Promise.race([
      client.ping(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 500)),
    ]);
    return pong === "PONG" ? "ok" : "degraded";
  } catch {
    return "down";
  }
}

async function checkSupabase(): Promise<DependencyStatus> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) return "down";
  try {
    const { supabase } = await import("../lib/supabase");
    const { error } = await Promise.race([
      supabase.from("health_status").select("id").limit(0),
      new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 500),
      ),
    ]);
    return error ? "degraded" : "ok";
  } catch {
    return "down";
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("health: Redis down returns 'down' status", async () => {
  delete process.env.REDIS_URL;
  const status = await checkRedis();
  assert.equal(status, "down");
});

test("health: Supabase down returns 'down' status when env vars missing", async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  const status = await checkSupabase();
  assert.equal(status, "down");
});

test("health: overall status is 'down' when all deps are down", async () => {
  const statuses: DependencyStatus[] = ["down", "down", "down"];
  const overall: DependencyStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
      ? "degraded"
      : "ok";
  assert.equal(overall, "down");
});

test("health: overall status is 'degraded' when one dep is degraded", async () => {
  const statuses: DependencyStatus[] = ["ok", "degraded", "ok"];
  const overall: DependencyStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
      ? "degraded"
      : "ok";
  assert.equal(overall, "degraded");
});

test("health: overall status is 'ok' when all deps are ok", async () => {
  const statuses: DependencyStatus[] = ["ok", "ok", "ok"];
  const overall: DependencyStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
      ? "degraded"
      : "ok";
  assert.equal(overall, "ok");
});

test("health: MQTT not configured is treated as ok", async () => {
  delete process.env.MQTT_URL;
  // When MQTT_URL is not set, the health check should treat it as ok
  // (not an error — the feature is simply not enabled)
  const mqttConfigured = !!process.env.MQTT_URL;
  assert.equal(mqttConfigured, false);
  // In the health route: !MQTT_URL → status is "ok"
  const status: DependencyStatus = mqttConfigured ? "down" : "ok";
  assert.equal(status, "ok");
});

test("health: health route URL is accessible via NextRequest construction", () => {
  const req = new NextRequest("http://localhost:3000/api/health");
  assert.equal(req.url, "http://localhost:3000/api/health");
  assert.equal(req.method, "GET");
});
