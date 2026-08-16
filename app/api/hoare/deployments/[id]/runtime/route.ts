import { deploymentRegistry } from "@/lib/hoare/deployment/deployment-registry";
import { nativeRuntimeExecutor } from "@/lib/hoare/deployment/native-runtime-executor";

function tenantIdFrom(request: Request): string | null {
  return request.headers.get("x-tenant-id")?.trim() || null;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const tenantId = tenantIdFrom(request);
  if (!tenantId) return Response.json({ error: "x-tenant-id is required" }, { status: 400 });

  const { id } = await context.params;
  const deployment = await deploymentRegistry.get(tenantId, id);
  if (!deployment) return Response.json({ error: "deployment not found" }, { status: 404 });

  return Response.json({ data: nativeRuntimeExecutor.status(id) });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const tenantId = tenantIdFrom(request);
  if (!tenantId) return Response.json({ error: "x-tenant-id is required" }, { status: 400 });

  const { id } = await context.params;
  const deployment = await deploymentRegistry.get(tenantId, id);
  if (!deployment) return Response.json({ error: "deployment not found" }, { status: 404 });

  const body = (await request.json()) as { command?: string; args?: string[] };
  const command = String(body.command ?? "").trim();
  const args = Array.isArray(body.args) && body.args.every((value) => typeof value === "string")
    ? body.args
    : [];

  if (!command) return Response.json({ error: "command is required" }, { status: 400 });

  try {
    const runtime = await nativeRuntimeExecutor.start(deployment, command, args);
    return Response.json({ data: runtime }, { status: 202 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "runtime start failed" }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const tenantId = tenantIdFrom(request);
  if (!tenantId) return Response.json({ error: "x-tenant-id is required" }, { status: 400 });

  const { id } = await context.params;
  const runtime = await nativeRuntimeExecutor.stop(tenantId, id);
  if (!runtime) return Response.json({ error: "runtime is not running" }, { status: 404 });
  return Response.json({ data: runtime });
}
