/**
 * GET /api/telemetry — Return the last N telemetry records for the tenant
 *
 * Protected: requires at least the "viewer" role.
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyToken, extractBearerToken, hasMinRole } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cached } from "@/lib/redis";

const CACHE_TTL_SECONDS = 5;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

type TelemetryRow = {
  id: string;
  device_id: string;
  payload: Record<string, unknown>;
  received_at: string;
  tenant_id: string;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user;
  try {
    user = verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinRole(user.role, "viewer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Query params
  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const cacheKey = `telemetry:${user.tenantId}:limit=${limit}`;
    const rows = await cached<TelemetryRow[]>(cacheKey, CACHE_TTL_SECONDS, async () => {
      const { data, error } = await supabase
        .from("telemetry")
        .select("id, device_id, payload, received_at, tenant_id")
        .eq("tenant_id", user.tenantId)
        .order("received_at", { ascending: false })
        .limit(limit);

      if (error) throw new Error(`Supabase query failed: ${error.message}`);
      return (data ?? []) as TelemetryRow[];
    });

    return NextResponse.json({ data: rows, count: rows.length });
  } catch (err) {
    console.error("[api/telemetry] Error", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
