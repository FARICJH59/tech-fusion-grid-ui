/**
 * GET /api/audit — Return the audit log for the tenant
 *
 * Protected: requires at least the "operator" role.
 */

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logger } from "@/lib/telemetry/otel";
import { withAuth, withErrorHandler, toNextRoute, type AuthenticatedContext } from "@/lib/middleware/api";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type AuditRow = {
  id: string;
  actor_id: string;
  action: string;
  details: string;
  timestamp: string;
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

        const { data, error } = await supabaseAdmin
          .from("audit_events")
          .select("id, actor_id, action, details, timestamp, tenant_id")
          .eq("tenant_id", user.tenantId)
          .order("timestamp", { ascending: false })
          .limit(limit);

        if (error) {
          logger.error("[api/audit] Supabase query failed", {
            tenantId: user.tenantId,
            error: error.message,
          });
          return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
        }

        logger.info("[api/audit] Served audit log", {
          tenantId: user.tenantId,
          count: (data ?? []).length,
          limit,
        });

        return NextResponse.json({ data: (data ?? []) as AuditRow[], count: (data ?? []).length });
      },
      { role: "operator" },
    ),
  ),
);
