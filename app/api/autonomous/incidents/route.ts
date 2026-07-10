/**
 * GET /api/autonomous/incidents — list incidents and stats
 * Supports query params: ?status=open&severity=high
 */

import { NextResponse, type NextRequest } from "next/server";
import { toNextRoute, withErrorHandler, withAuth } from "@/lib/middleware/api";
import { selfHealingEngine } from "@/lib/autonomous/healing";
import type { IncidentStatus, IncidentSeverity } from "@/lib/autonomous/types";

export const GET = toNextRoute(
  withErrorHandler(
    withAuth(async (req: NextRequest) => {
      const { searchParams } = new URL(req.url);
      const status = searchParams.get("status") as IncidentStatus | null;
      const severity = searchParams.get("severity") as IncidentSeverity | null;

      const incidents = selfHealingEngine.listIncidents({
        status: status ?? undefined,
        severity: severity ?? undefined,
      });

      return NextResponse.json({
        incidents,
        stats: selfHealingEngine.getStats(),
      });
    }, { role: "operator" }),
  ),
);
