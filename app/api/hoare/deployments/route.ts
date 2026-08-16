import { deploymentRegistry, type DeploymentTarget } from "@/lib/hoare/deployment/deployment-registry";

function tenantIdFrom(request: Request): string | null {
  return request.headers.get("x-tenant-id")?.trim() || null;
}

export async function GET(request: Request) {
  const tenantId = tenantIdFrom(request);
  if (!tenantId) return Response.json({ error: "x-tenant-id is required" }, { status: 400 });

  const deployments = await deploymentRegistry.list(tenantId);
  return Response.json({ data: deployments, count: deployments.length });
}

export async function POST(request: Request) {
  const tenantId = tenantIdFrom(request);
  if (!tenantId) return Response.json({ error: "x-tenant-id is required" }, { status: 400 });

  const body = (await request.json()) as Record<string, unknown>;
  const projectId = String(body.projectId ?? "").trim();
  const name = String(body.name ?? "").trim();
  if (!projectId || !name) {
    return Response.json({ error: "projectId and name are required" }, { status: 400 });
  }

  const deployment = await deploymentRegistry.create({
    id: crypto.randomUUID(),
    tenantId,
    projectId,
    name,
    target: (body.target as DeploymentTarget) ?? "full-stack",
    status: "planned",
    version: String(body.version ?? "v1"),
    region: String(body.region ?? "local"),
    frontendEndpoint: typeof body.frontendEndpoint === "string" ? body.frontendEndpoint : undefined,
    backendEndpoint: typeof body.backendEndpoint === "string" ? body.backendEndpoint : undefined,
    sourceRef: typeof body.sourceRef === "string" ? body.sourceRef : undefined,
    manifest: typeof body.manifest === "object" && body.manifest !== null
      ? (body.manifest as Record<string, unknown>)
      : undefined,
  });

  return Response.json({ data: deployment }, { status: 201 });
}
