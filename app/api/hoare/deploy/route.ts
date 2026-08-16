import { NextResponse } from "next/server";
import { createApplicationBuildPlan, validateApplicationBuildPlan, type ApplicationIntent } from "@/lib/hoare/factory/application-contract";
import { executeNativeApplication } from "@/lib/hoare/factory/application-execution";
import { createDeploymentManifest, markDeploymentReady, validateDeploymentManifest } from "@/lib/hoare/deployment/deployment-contract";
import { persistRuntime } from "@/lib/hoare/deployment/runtime-store";
import { provisionOwnedRuntime } from "@/lib/hoare/deployment/owned-runtime";

export async function POST(request: Request) {
  try {
    const body = await request.json() as ApplicationIntent & { domain?: string };
    const plan = createApplicationBuildPlan(body);
    validateApplicationBuildPlan(plan);
    const execution = await executeNativeApplication(plan);
    const manifest = createDeploymentManifest({ tenantId: plan.tenantId, projectId: plan.projectId, applicationId: execution.applicationId, releaseDigest: plan.releaseDigest, target: plan.target, domain: body.domain });
    validateDeploymentManifest(manifest);

    if (manifest.target !== "owned-runtime") {
      return NextResponse.json({ ok: true, lifecycle: "adapter-ready", controlPlane: "hoare", manifest }, { status: 201 });
    }

    const deployment = markDeploymentReady(manifest);
    const runtime = provisionOwnedRuntime(deployment);
    await persistRuntime({
      manifest: deployment,
      runtime: { ...runtime, lifecycle: "stopped", generation: 0, supervisorHeartbeat: new Date().toISOString() },
      workspace: execution.workspace,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, lifecycle: "provisioned", controlPlane: "hoare", manifest: deployment, runtime, workspace: { digest: execution.workspace.digest, fileCount: execution.workspace.files.length } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Deployment failed" }, { status: 400 });
  }
}
