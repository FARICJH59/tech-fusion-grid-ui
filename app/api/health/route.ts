/**
 * GET /api/health
 *
 * Returns liveness/readiness status for the application and its dependencies.
 * Probes Supabase, Redis, and MQTT in parallel with a short timeout.
 */

import { NextResponse, type NextRequest } from "next/server";
import { mqttClient } from "@/lib/mqtt";
import { logger } from "@/lib/telemetry/otel";
import { withErrorHandler, toNextRoute } from "@/lib/middleware/api";

type DependencyStatus = "ok" | "degraded" | "down";

type HealthResponse = {
  status: DependencyStatus;
  timestamp: string;
  version: string;
  dependencies: {
    mqtt: DependencyStatus;
    supabase: DependencyStatus;
    redis: DependencyStatus;
  };
};

async function checkRedis(): Promise<DependencyStatus> {
  try {
    const { getRedis } = await import("@/lib/redis");
    const client = getRedis();
    const pong = await Promise.race([
      client.ping(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 2_000)),
    ]);
    return pong === "PONG" ? "ok" : "degraded";
  } catch {
    return "down";
  }
}

async function checkSupabase(): Promise<DependencyStatus> {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return "down";
    }
    const { supabase } = await import("@/lib/supabase");
    // `health_status` is defined in migrations/001_init.sql.
    // We query it with a 0-row limit purely to verify DB connectivity.
    const { error } = await Promise.race([
      supabase.from("health_status").select("id").limit(0),
      new Promise<{ error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3_000),
      ),
    ]);
    return error ? "degraded" : "ok";
  } catch {
    return "down";
  }
}

export const GET = toNextRoute(withErrorHandler(async (_req: NextRequest): Promise<NextResponse<HealthResponse>> => {
  const mqttState = mqttClient.getConnectionState();
  const mqttStatus: DependencyStatus =
    mqttState === "connected"
      ? "ok"
      : mqttState === "reconnecting"
        ? "degraded"
        : process.env.MQTT_URL
          ? "down"
          : "ok"; // not configured — not a fault

  const [redisStatus, supabaseStatus] = await Promise.all([checkRedis(), checkSupabase()]);

  const statuses: DependencyStatus[] = [mqttStatus, redisStatus, supabaseStatus];
  const overall: DependencyStatus = statuses.includes("down")
    ? "down"
    : statuses.includes("degraded")
      ? "degraded"
      : "ok";

  const body: HealthResponse = {
    status: overall,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "unknown",
    dependencies: {
      mqtt: mqttStatus,
      supabase: supabaseStatus,
      redis: redisStatus,
    },
  };

  if (overall !== "ok") {
    logger.warn("[api/health] Degraded health status", { overall, mqtt: mqttStatus, redis: redisStatus, supabase: supabaseStatus });
  }

  return NextResponse.json(body, { status: overall === "down" ? 503 : 200 });
}));
