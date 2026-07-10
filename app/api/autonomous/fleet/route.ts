/**
 * GET  /api/autonomous/fleet — list nodes and fleet health
 * POST /api/autonomous/fleet — register node or send heartbeat
 */

import { NextResponse, type NextRequest } from "next/server";
import { toNextRoute, withErrorHandler, withAuth } from "@/lib/middleware/api";
import { fleetManager } from "@/lib/autonomous/fleet";
import type { FleetNode } from "@/lib/autonomous/types";

export const GET = toNextRoute(
  withErrorHandler(
    withAuth(async (_req: NextRequest) => {
      return NextResponse.json({
        nodes: fleetManager.listNodes(),
        health: fleetManager.getFleetHealth(),
      });
    }, { role: "operator" }),
  ),
);

export const POST = toNextRoute(
  withErrorHandler(
    withAuth(async (req: NextRequest) => {
      const body = (await req.json()) as {
        action: "register" | "heartbeat";
        node?: Omit<FleetNode, "registeredAt" | "lastHeartbeat">;
        nodeId?: string;
        metrics?: FleetNode["metrics"];
      };

      if (body.action === "register") {
        if (!body.node) {
          return NextResponse.json({ error: "node payload required for register" }, { status: 400 });
        }
        const registered = fleetManager.registerNode(body.node);
        return NextResponse.json({ node: registered }, { status: 201 });
      }

      if (body.action === "heartbeat") {
        if (!body.nodeId) {
          return NextResponse.json({ error: "nodeId required for heartbeat" }, { status: 400 });
        }
        fleetManager.heartbeat(body.nodeId, body.metrics);
        return NextResponse.json({ ok: true, nodeId: body.nodeId });
      }

      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }, { role: "operator" }),
  ),
);
