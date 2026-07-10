/**
 * GET  /api/autonomous/deployments — list deployment plans
 * POST /api/autonomous/deployments — create and auto-approve a plan
 */

import { NextResponse, type NextRequest } from "next/server";
import { toNextRoute, withErrorHandler, withAuth } from "@/lib/middleware/api";
import { autonomousDevOps } from "@/lib/autonomous/devops";
import type { DeploymentStrategy } from "@/lib/autonomous/types";

export const GET = toNextRoute(
  withErrorHandler(
    withAuth(async (req: NextRequest) => {
      const { searchParams } = new URL(req.url);
      const serviceId = searchParams.get("serviceId") ?? undefined;
      return NextResponse.json({ plans: autonomousDevOps.listPlans(serviceId) });
    }, { role: "admin" }),
  ),
);

export const POST = toNextRoute(
  withErrorHandler(
    withAuth(async (req: NextRequest) => {
      const body = (await req.json()) as {
        serviceId: string;
        fromVersion: string;
        toVersion: string;
        strategy: DeploymentStrategy;
        canaryWeight?: number;
      };

      if (!body.serviceId || !body.fromVersion || !body.toVersion || !body.strategy) {
        return NextResponse.json(
          { error: "serviceId, fromVersion, toVersion, and strategy are required" },
          { status: 400 },
        );
      }

      const plan = autonomousDevOps.planAndApprove(
        {
          serviceId: body.serviceId,
          fromVersion: body.fromVersion,
          toVersion: body.toVersion,
          strategy: body.strategy,
          canaryWeight: body.canaryWeight,
        },
        "api",
      );

      return NextResponse.json({ plan }, { status: 201 });
    }, { role: "admin" }),
  ),
);
