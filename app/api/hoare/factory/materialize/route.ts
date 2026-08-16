import { NextResponse } from "next/server";
import {
  createApplicationBuildPlan,
  validateApplicationBuildPlan,
  type ApplicationIntent,
} from "@/lib/hoare/factory/application-contract";
import { buildApplicationArtifactGraph } from "@/lib/hoare/factory/application-graph";
import { persistApplicationArtifacts } from "@/lib/hoare/factory/application-persistence";

export async function POST(request: Request) {
  try {
    const intent = (await request.json()) as ApplicationIntent;
    const plan = createApplicationBuildPlan(intent);
    validateApplicationBuildPlan(plan);
    const graph = buildApplicationArtifactGraph(plan);

    const artifacts = graph.nodes.map((node) => ({
      path: `components/${node.id}.json`,
      content: `${JSON.stringify(node, null, 2)}\n`,
    }));

    const result = await persistApplicationArtifacts(
      `${plan.tenantId}-${plan.projectId}-${plan.releaseDigest.slice(0, 12)}`,
      [
        ...artifacts,
        {
          path: "application.manifest.json",
          content: `${JSON.stringify(plan, null, 2)}\n`,
        },
      ],
    );

    return NextResponse.json({
      ok: true,
      lifecycle: "materialized",
      executionBoundary: "hoare-owned-runtime",
      graph,
      artifact: result,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Application materialization failed" },
      { status: 400 },
    );
  }
}
