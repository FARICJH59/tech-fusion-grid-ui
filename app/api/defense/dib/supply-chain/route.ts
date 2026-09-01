import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { authenticateControlPlane, resolveResourceTenant } from "@/lib/enterprise/control-plane-auth";
import {
  assessDIBSupplyChain,
  DIB_SUPPLY_CHAIN_SERVICE,
  type DIBSupplyGraph,
} from "@/lib/enterprise/defense/dib-supply-chain";

function bearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Request denied";
  const status = message.startsWith("Authentication required")
    ? 401
    : message.startsWith("Forbidden")
      ? 403
      : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const token = bearerToken(request);
    if (!token) return errorResponse(new Error("Authentication required"));
    const principal = verifyToken(token);
    const tenantId = resolveResourceTenant(
      principal.tenantId,
      request.nextUrl.searchParams.get("tenantId"),
    );
    authenticateControlPlane(request.headers.get("authorization"), "read", tenantId);

    return NextResponse.json({
      success: true,
      service: DIB_SUPPLY_CHAIN_SERVICE,
      tenantId,
      actor: { sub: principal.sub, role: principal.role },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);
    if (!token) return errorResponse(new Error("Authentication required"));
    const principal = verifyToken(token);
    const body = await request.json();
    const requestedTenant = typeof body?.tenantId === "string" ? body.tenantId : null;
    const tenantId = resolveResourceTenant(principal.tenantId, requestedTenant);
    authenticateControlPlane(request.headers.get("authorization"), "write", tenantId);

    const graph = body?.graph as DIBSupplyGraph | undefined;
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return NextResponse.json(
        { success: false, error: "graph.nodes and graph.edges are required" },
        { status: 400 },
      );
    }

    const assessment = assessDIBSupplyChain(graph);
    return NextResponse.json({
      success: true,
      tenantId,
      actor: { sub: principal.sub, role: principal.role },
      assessment,
      executionBoundary: DIB_SUPPLY_CHAIN_SERVICE.executionBoundary,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
