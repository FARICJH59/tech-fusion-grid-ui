import { NextResponse } from "next/server";
import {
  createApplicationBuildPlan,
  validateApplicationBuildPlan,
  type ApplicationIntent,
} from "@/lib/hoare/factory/application-contract";
import { buildApplicationArtifactGraph } from "@/lib/hoare/factory/application-graph";
import { executeNativeApplication } from "@/lib/hoare/factory/application-execution";
import { persistApplicationArtifacts } from "@/lib/hoare/factory/application-persistence";

export async function POST(request: Request) {
  try {
    const intent = (await request.json()) as ApplicationIntent;
    const plan = createApplicationBuildPlan(intent);
    validateApplicationBuildPlan(plan);
    const graph = buildApplicationArtifactGraph(plan);
    const execution = await executeNativeApplication(plan);

    const artifacts = execution.workspace.files.map((file) => ({
      path: file.path,
      content: file.content,
    }));

    const result = await persistApplicationArtifacts(
      `${plan.tenantId}-${plan.projectId}-${plan.releaseDigest.slice(0, 12)}`,
      [
        ...artifacts,
        ...graph.nodes.map((node) => ({
          path: `components/${node.id}.json`,
          content: `${JSON.stringify(node, null, 2)}\n`,
        })),
      ],
    );

    return NextResponse.json({
      ok: true,
      lifecycle: execution.lifecycle,
      executionBoundary: "hoare-owned-runtime",
      graph,
      build: execution.build,
      workspace: execution.workspace,
      artifact: result,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Application materialization failed" },
      { status: 400 },
    );
  }
}
