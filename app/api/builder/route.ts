import { NextRequest, NextResponse } from "next/server";
import { authenticateControlPlane, resolveResourceTenant } from "@/lib/enterprise/control-plane-auth";
import { extractBearerToken, verifyToken } from "@/lib/auth";
import { buildResource, type BuilderRequest } from "@/lib/hoare/builder";
import { authorizeBuild } from "@/lib/hoare/builder-authorizer";

function denied(error: unknown) {
  const message = error instanceof Error ? error.message : "Request denied";
  const status = message.startsWith("Authentication required") ? 401 : message.startsWith("Forbidden") ? 403 : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const token = extractBearerToken(request.headers.get("authorization"));
    if (!token) throw new Error("Authentication required");

    const principal = verifyToken(token);
    const body = (await request.json()) as Partial<BuilderRequest>;
    const tenantId = resolveResourceTenant(principal.tenantId, typeof body.tenantId === "string" ? body.tenantId : null);
    authenticateControlPlane(request.headers.get("authorization"), "write", tenantId);

    const builderRequest: BuilderRequest = {
      tenantId,
      name: body.name || "",
      kind: body.kind as BuilderRequest["kind"],
      description: body.description,
      capabilities: body.capabilities,
      mode: body.mode,
      runtime: body.runtime,
    };

    const artifact = buildResource(builderRequest);
    const authorization = authorizeBuild(builderRequest, artifact);

    if (!authorization.authorized) {
      return NextResponse.json({ success: false, decision: authorization.decision, reason: authorization.reason, tenantId, artifact }, { status: 403 });
    }

    return NextResponse.json({ success: true, decision: "ALLOW", tenantId, actor: { sub: principal.sub, role: principal.role }, artifact, governance: authorization.policy }, { status: 201 });
  } catch (error) {
    return denied(error);
  }
}
