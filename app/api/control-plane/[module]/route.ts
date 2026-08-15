import { NextRequest, NextResponse } from "next/server";
import {
  authenticateControlPlane,
  resolveResourceTenant,
} from "@/lib/enterprise/control-plane-auth";
import { buildDefaultControlPlane } from "@/lib/enterprise/control-plane";
import { verifyToken } from "@/lib/auth";

const controlPlane = buildDefaultControlPlane();

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Request denied";
  const status = message.startsWith("Authentication required")
    ? 401
    : message.startsWith("Forbidden")
      ? 403
      : 400;
  return NextResponse.json(
    { success: false, error: message },
    { status },
  );
}

function bearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");
  return authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ module: string }> },
) {
  try {
    const { module } = await context.params;
    const moduleInfo = controlPlane.get(module);
    if (!moduleInfo) {
      return NextResponse.json(
        { success: false, error: "Unknown control-plane module" },
        { status: 404 },
      );
    }

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
      module: moduleInfo,
      tenantId,
      actor: { sub: principal.sub, role: principal.role },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ module: string }> },
) {
  try {
    const { module } = await context.params;
    const moduleInfo = controlPlane.get(module);
    if (!moduleInfo) {
      return NextResponse.json(
        { success: false, error: "Unknown control-plane module" },
        { status: 404 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const token = bearerToken(request);
    if (!token) return errorResponse(new Error("Authentication required"));

    const principal = verifyToken(token);
    const requestedTenant =
      typeof body.tenantId === "string" ? body.tenantId : null;
    const tenantId = resolveResourceTenant(principal.tenantId, requestedTenant);
    authenticateControlPlane(request.headers.get("authorization"), "write", tenantId);

    return NextResponse.json(
      {
        success: true,
        accepted: true,
        module: moduleInfo.slug,
        tenantId,
        action: "write",
        actor: { sub: principal.sub, role: principal.role },
        payload: body,
        message: "Control-plane command accepted by the authorization gateway.",
      },
      { status: 202 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
