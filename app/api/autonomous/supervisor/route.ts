/**
 * GET /api/autonomous/supervisor  — list services and health summary
 * POST /api/autonomous/supervisor — trigger restart actions
 */

import { NextResponse, type NextRequest } from "next/server";
import { toNextRoute, withErrorHandler, withAuth } from "@/lib/middleware/api";
import { runtimeSupervisor } from "@/lib/autonomous/supervisor";

export const GET = toNextRoute(
  withErrorHandler(
    withAuth(async (_req: NextRequest) => {
      return NextResponse.json({
        services: runtimeSupervisor.listServices(),
        health: runtimeSupervisor.getHealthSummary(),
      });
    }, { role: "operator" }),
  ),
);

export const POST = toNextRoute(
  withErrorHandler(
    withAuth(async (req: NextRequest) => {
      const body = (await req.json()) as {
        action: "restart" | "rolling-restart";
        serviceId?: string;
      };

      if (body.action === "restart") {
        if (!body.serviceId) {
          return NextResponse.json({ error: "serviceId required for restart" }, { status: 400 });
        }
        await runtimeSupervisor.triggerRestart(body.serviceId, "manual-api");
        return NextResponse.json({ ok: true, serviceId: body.serviceId });
      }

      if (body.action === "rolling-restart") {
        await runtimeSupervisor.rollingRestart();
        return NextResponse.json({ ok: true, action: "rolling-restart" });
      }

      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }, { role: "operator" }),
  ),
);
