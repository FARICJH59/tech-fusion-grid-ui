import { NextResponse, type NextRequest } from "next/server";
import { hoareRuntime } from "@/lib/runtime/manager";
import {
  withAuth,
  withErrorHandler,
  toNextRoute,
  type AuthenticatedContext,
} from "@/lib/middleware/api";

export const GET = toNextRoute(
  withErrorHandler(
    withAuth(async (_req: NextRequest, _ctx: AuthenticatedContext): Promise<NextResponse> => {
      if (hoareRuntime.getState() === "stopped") {
        await hoareRuntime.start();
      }

      return NextResponse.json({
        state: hoareRuntime.getState(),
        agents: hoareRuntime.agents.count(),
        tools: hoareRuntime.tools.count(),
        workflows: hoareRuntime.workflows.count(),
        queueSize: hoareRuntime.queue.size(),
        timestamp: new Date().toISOString(),
      });
    }, { role: "operator" }),
  ),
);
