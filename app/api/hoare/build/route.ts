import { NextRequest, NextResponse } from "next/server";
import { authenticateControlPlane, resolveResourceTenant } from "@/lib/enterprise/control-plane-auth";

export const runtime = "nodejs";

const TARGETS = new Set(["github", "termux"]);

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Build request denied";
  const status = message.startsWith("Authentication required") ? 401 : message.startsWith("Forbidden") ? 403 : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

/**
 * Safe HTTP control-plane entry point. It authenticates and validates a build
 * intent; an already-admitted TCX execution transaction must invoke the provider
 * to perform the actual side effect.
 */
export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");
    const body = await request.json() as Record<string, unknown>;
    const requestedTenant = typeof body.tenantId === "string" ? body.tenantId : null;
    const principalTenant = authorization ? (await import("@/lib/auth")).verifyToken(authorization.replace(/^Bearer\s+/i, "")).tenantId : "";
    const tenantId = resolveResourceTenant(principalTenant, requestedTenant);
    authenticateControlPlane(authorization, "write", tenantId);

    const target = typeof body.target === "string" ? body.target : "";
    const repository = typeof body.repository === "string" ? body.repository.trim() : "";
    const ref = typeof body.ref === "string" ? body.ref.trim() : "";
    const workflow = typeof body.workflow === "string" ? body.workflow.trim() : "";
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";

    if (!TARGETS.has(target) || !repository || !ref || !workflow || !projectId) {
      return NextResponse.json({
        success: false,
        error: "Invalid build request: target, repository, ref, workflow, and projectId are required.",
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      status: "admission_required",
      tenantId,
      target,
      repository,
      ref,
      workflow,
      projectId,
      message: "Build intent accepted by the HTTP control plane; TCX admission and issuer-created authority are required before execution.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
