import { NextRequest, NextResponse } from "next/server";
import { resolveResourceTenant } from "@/lib/enterprise/control-plane-auth";
import { extractBearerToken, verifyToken } from "@/lib/auth";
import { deployResource, listDeploymentTargets, type DeploymentRequest } from "@/lib/hoare/deployment";

function denied(error: unknown) {
  const message = error instanceof Error ? error.message : "Request denied";
  const status = message.startsWith("Authentication required") ? 401 : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET() {
  return NextResponse.json({ success: true, targets: listDeploymentTargets() });
}

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) throw new Error("Authentication required");

    const principal = verifyToken(token);
    const body = (await request.json()) as Partial<DeploymentRequest>;
    if (!body.artifact || typeof body.tenantId !== "string" || typeof body.target !== "string") {
      throw new Error("artifact, tenantId and target are required");
    }

    const tenantId = resolveResourceTenant(principal.tenantId, body.tenantId);
    const result = deployResource({
      tenantId,
      artifact: body.artifact,
      target: body.target as DeploymentRequest["target"],
      environment: typeof body.environment === "string" ? body.environment : undefined,
    });

    return NextResponse.json(
      { success: result.decision === "ALLOW", actor: { sub: principal.sub, role: principal.role }, ...result },
      { status: result.decision === "ALLOW" ? 200 : 403 },
    );
  } catch (error) {
    return denied(error);
  }
}
