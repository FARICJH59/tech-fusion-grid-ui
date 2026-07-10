/**
 * GET /api/autonomous/compliance — run all compliance checks and return results
 */

import { NextResponse, type NextRequest } from "next/server";
import { toNextRoute, withErrorHandler, withAuth } from "@/lib/middleware/api";
import { complianceAutomation } from "@/lib/autonomous/compliance";

export const GET = toNextRoute(
  withErrorHandler(
    withAuth(async (req: NextRequest) => {
      const { searchParams } = new URL(req.url);
      const tenantId = searchParams.get("tenantId") ?? undefined;

      const checks = await complianceAutomation.runChecks(tenantId);
      const summary = complianceAutomation.getComplianceSummary();

      return NextResponse.json({ checks, summary });
    }, { role: "operator" }),
  ),
);
