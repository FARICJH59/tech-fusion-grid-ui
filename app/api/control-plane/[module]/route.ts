import { NextRequest, NextResponse } from "next/server";
import {
  authenticateControlPlane,
  resolveResourceTenant,
} from "@/lib/enterprise/control-plane-auth";
import { buildDefaultControlPlane } from "@/lib/enterprise/control-plane";

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ module: string }> },
) {
  try {
    const { module } = await context.params;
    const resourceTenantId = resolveResourceTenant(
      "",
      request.nextUrl.searchParams.get("tenantId"),
    );

    // The tenant is resolved from the verified JWT below. The first pass above
    // intentionally only validates request shape; the authenticated tenant is
    // the authoritative value used for isolation.
    const requestedTenant = request.nextUrl.searchParams.get("tenantId");
    const token = request.headers.get("authorization");
    const principalProbe = token?.startsWith("Bearer ")
      ? undefined
      : undefined;
    void principalProbe;
    void resourceTenantId;

    const moduleInfo = controlPlane.get(module);
    if (!moduleInfo) {
      return NextResponse.json(
        { success: false, error: "Unknown control-plane module" },
        { status: 404 },
      );
    }

    // Authenticate after module resolution. Tenant scope is derived from the
    // signed token and may not be supplied by an untrusted client.
    const rawToken = token?.startsWith("Bearer ") ? token.slice(7) : null;
    if (!rawToken) return errorResponse(new Error("Authentication required"));

    const { verifyToken } = await import("@/lib/auth");
    const principal = verifyToken(rawToken);
    const tenantId = resolveResourceTenant(
      principal.tenantId,
      requestedTenant,
    );
    authenticateControlPlane(token, "read", tenantId);

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
    const requestedTenant =
      typeof body.tenantId === "string" ? body.tenantId : null;

    const token = request.headers.get("authorization");
    const rawToken = token?.startsWith("Bearer ") ? token.slice(7) : null;
    if (!rawToken) return errorResponse(new Error("Authentication required"));

    const { verifyToken } = await import("@/lib/auth");
    const principal = verifyToken(rawToken);
    const tenantId = resolveResourceTenant(
      principal.tenantId,
      requestedTenant,
    );
    authenticateControlPlane(token, "write", tenantId);

    return NextResponse.json({
      success: true,
      accepted: true,
      module: moduleInfo.slug,
      tenantId,
      action: "write",
      actor: { sub: principal.sub, role: principal.role },
      payload: body,
      message: "Control-plane command accepted by the authorization gateway.",
    }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
