import { deploymentRegistry, type DeploymentStatus } from "@/lib/hoare/deployment/deployment-registry";

function tenantIdFrom(request: Request): string | null {
  return request.headers.get("x-tenant-id")?.trim() || null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const tenantId = tenantIdFrom(request);
  if (!tenantId) return Response.json({ error: "x-tenant-id is required" }, { status: 400 });

  const { id } = await context.params;
  const deployment = await deploymentRegistry.get(tenantId, id);
  if (!deployment) return Response.json({ error: "deployment not found" }, { status: 404 });
  return Response.json({ data: deployment });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const tenantId = tenantIdFrom(request);
  if (!tenantId) return Response.json({ error: "x-tenant-id is required" }, { status: 400 });

  const { id } = await context.params;
  const body = (await request.json()) as { status?: DeploymentStatus; error?: string };
  if (!body.status) return Response.json({ error: "status is required" }, { status: 400 });

  const deployment = await deploymentRegistry.update(tenantId, id, {
    status: body.status,
    error: body.error,
  });
  return Response.json({ data: deployment });
}
