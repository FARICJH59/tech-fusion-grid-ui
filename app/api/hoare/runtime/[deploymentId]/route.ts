import { NextResponse } from "next/server";
import { runtimeSupervisor } from "@/lib/hoare/deployment/runtime-supervisor";

export const dynamic = "force-dynamic";

type RuntimeRouteContext = { params: Promise<{ deploymentId: string }> };

export async function GET(_request: Request, { params }: RuntimeRouteContext) {
  try {
    const { deploymentId } = await params;
    const runtime = await runtimeSupervisor.get(deploymentId);
    return NextResponse.json({ ok: true, controlPlane: "hoare", runtime: runtime.runtime, manifest: runtime.manifest });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Runtime unavailable" }, { status: 404 });
  }
}

export async function POST(request: Request, { params }: RuntimeRouteContext) {
  try {
    const { deploymentId } = await params;
    const body = await request.json() as { action?: "start" | "stop" | "restart" };
    if (!body.action || !["start", "stop", "restart"].includes(body.action)) {
      return NextResponse.json({ ok: false, error: "action must be start, stop, or restart" }, { status: 400 });
    }

    const runtime = await runtimeSupervisor[body.action](deploymentId);
    return NextResponse.json({ ok: true, controlPlane: "hoare", runtime: runtime.runtime });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Runtime operation failed" }, { status: 400 });
  }
}
