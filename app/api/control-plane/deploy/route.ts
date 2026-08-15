import { NextRequest, NextResponse } from "next/server";
import { authenticateControlPlane, resolveResourceTenant } from "@/lib/enterprise/control-plane-auth";
import { verifyToken } from "@/lib/auth";
import { createDeploymentPlan } from "@/lib/hoare/control-plane/deployment";
import type { ApplicationResource, DomainResource, InfrastructureNode, TenantResource } from "@/lib/hoare/control-plane/types";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Deployment request denied";
  const status = message.startsWith("Authentication required") ? 401 : message.startsWith("Forbidden") ? 403 : 400;
  return NextResponse.json({ success: false, error: message }, { status });
}

function bearerToken(request: NextRequest): string | null {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request);
    if (!token) return errorResponse(new Error("Authentication required"));

    const principal = verifyToken(token);
    const body = await request.json();
    const tenantId = resolveResourceTenant(
      principal.tenantId,
      typeof body.tenantId === "string" ? body.tenantId : null,
    );
    authenticateControlPlane(request.headers.get("authorization"), "write", tenantId);

    const tenant: TenantResource = {
      id: tenantId,
      organizationId: typeof body.organizationId === "string" ? body.organizationId : "tech-fusion-ai-ml",
      name: typeof body.tenantName === "string" ? body.tenantName : tenantId,
      region: typeof body.region === "string" ? body.region : "US",
      dataResidency: typeof body.dataResidency === "string" ? body.dataResidency : "US",
      isolation: body.isolation === "vm" || body.isolation === "dedicated-node" || body.isolation === "dedicated-server" ? body.isolation : "shared",
      status: body.tenantStatus === "suspended" ? "suspended" : "active",
    };

    const application: ApplicationResource = {
      id: typeof body.applicationId === "string" ? body.applicationId : "application-unknown",
      tenantId,
      name: typeof body.applicationName === "string" ? body.applicationName : "unnamed-application",
      vertical: typeof body.vertical === "string" ? body.vertical : "general",
      runtime: body.runtime === "vm" || body.runtime === "edge" ? body.runtime : "container",
      desiredNodeId: typeof body.nodeId === "string" ? body.nodeId : undefined,
      status: body.applicationStatus === "failed" ? "failed" : "draft",
    };

    const node: InfrastructureNode = {
      id: typeof body.nodeId === "string" ? body.nodeId : "hoare-node-001",
      name: typeof body.nodeName === "string" ? body.nodeName : "HOARE-NODE-001",
      kind: body.nodeKind === "cloud" || body.nodeKind === "edge" ? body.nodeKind : "bare-metal",
      provider: body.provider === "gcp" || body.provider === "cloudflare" || body.provider === "godaddy" || body.provider === "edge" ? body.provider : "bare-metal",
      region: typeof body.region === "string" ? body.region : "US",
      capabilities: Array.isArray(body.capabilities) ? body.capabilities.filter((v: unknown): v is string => typeof v === "string") : ["containers", "storage", "networking"],
      capacity: { cpu: 0, memoryGb: 0, storageGb: 0 },
      status: body.nodeStatus === "online" ? "online" : "provisioning",
    };

    const domain: DomainResource | undefined = typeof body.domainId === "string"
      ? {
          id: body.domainId,
          hostname: typeof body.hostname === "string" ? body.hostname : "",
          provider: body.domainProvider === "cloudflare" ? "cloudflare" : "godaddy",
          organizationId: tenant.organizationId,
          verified: body.domainVerified === true,
          tlsManaged: body.tlsManaged === true,
          status: body.domainStatus === "active" ? "active" : "pending",
        }
      : undefined;

    const plan = createDeploymentPlan({ tenant, application, node, domain });

    return NextResponse.json({
      success: true,
      plan,
      execution: plan.status === "ready" ? "planned" : "blocked",
      message: plan.status === "ready"
        ? "Deployment plan validated; runtime execution remains behind the provider adapter."
        : "Deployment blocked until the reported prerequisites are satisfied.",
    }, { status: plan.status === "ready" ? 200 : 409 });
  } catch (error) {
    return errorResponse(error);
  }
}
