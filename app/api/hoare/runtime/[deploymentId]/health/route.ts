import { NextResponse } from "next/server";
import { loadRuntime } from "@/lib/hoare/deployment/runtime-store";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { deploymentId: string } }) {
  const runtime = await loadRuntime(params.deploymentId);
  if (!runtime) {
    return NextResponse.json({ ok: false, error: "Deployment not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    controlPlane: "hoare",
    runtime: runtime.runtime.runtime,
    deploymentId: runtime.manifest.deploymentId,
    applicationId: runtime.manifest.applicationId,
    releaseDigest: runtime.manifest.releaseDigest,
    workspaceDigest: runtime.workspace.digest,
    fileCount: runtime.workspace.files.length,
    createdAt: runtime.createdAt,
  });
}
