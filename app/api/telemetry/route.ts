/**
 * GET /api/telemetry — Return the last N telemetry records for the tenant
 *
 * Protected: requires at least the "viewer" role.
 */

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { cached } from "@/lib/redis";
import { logger } from "@/lib/telemetry/otel";
import { withAuth, withErrorHandler, toNextRoute, type AuthenticatedContext } from "@/lib/middleware/api";

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

export const GET = toNextRoute(
  withErrorHandler(
    withAuth(
      async (req: NextRequest, ctx: AuthenticatedContext): Promise<NextResponse> => {
        const { user } = ctx;

        const url = new URL(req.url);
        const rawLimit = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
        const limit = Number.isFinite(rawLimit)
          ? Math.min(Math.max(1, rawLimit), MAX_LIMIT)
          : DEFAULT_LIMIT;

        const cacheKey = `telemetry:${user.tenantId}:limit=${limit}`;
        const rows = await cached<TelemetryRow[]>(cacheKey, CACHE_TTL_SECONDS, async () => {
          const { data, error } = await supabaseAdmin
            .from("telemetry")
            .select("id, device_id, payload, received_at, tenant_id")
            .eq("tenant_id", user.tenantId)
            .order("received_at", { ascending: false })
            .limit(limit);

          if (error) throw new Error(`Supabase query failed: ${error.message}`);
          return (data ?? []) as TelemetryRow[];
        });

        logger.info("[api/telemetry] Served telemetry", {
          tenantId: user.tenantId,
          count: rows.length,
          limit,
        });

        return NextResponse.json({ data: rows, count: rows.length });
      },
      { role: "viewer" },
    ),
  ),
);
