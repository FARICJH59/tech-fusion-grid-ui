/**
 * GET /api/autonomous/cost — tenant cost summary, breakdown, and recommendations
 * Query: ?tenantId=x
 */

import { NextResponse, type NextRequest } from "next/server";
import { toNextRoute, withErrorHandler, withAuth } from "@/lib/middleware/api";
import { costOptimizationEngine } from "@/lib/autonomous/cost";

export const GET = toNextRoute(
  withErrorHandler(
    withAuth(async (req: NextRequest) => {
      const { searchParams } = new URL(req.url);
      const tenantId = searchParams.get("tenantId") ?? "system";

      const [costs, breakdown, recommendations, alerts] = [
        costOptimizationEngine.getTenantCosts(tenantId),
        costOptimizationEngine.getCostBreakdown(tenantId),
        costOptimizationEngine.generateRecommendations(tenantId),
        costOptimizationEngine.checkAlerts(),
      ];

      return NextResponse.json({
        tenantId,
        totalMicroUsd: costOptimizationEngine.getTotalCostMicroUsd(tenantId),
        costs,
        breakdown,
        recommendations,
        alerts: alerts.filter((a) => a.tenantId === tenantId),
      });
    }, { role: "operator" }),
  ),
);
