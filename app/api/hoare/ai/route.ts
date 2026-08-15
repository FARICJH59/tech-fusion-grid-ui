import { NextResponse } from "next/server";
import { createModelProject, getModelProject, listModelProjects, listTrainingJobs, saveTrainingJob } from "@/lib/hoare/ai/catalog";
import { planTrainingJob } from "@/lib/hoare/ai/training-planner";
import type { InfrastructureNode } from "@/lib/hoare/control-plane/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") ?? undefined;
  const projectId = url.searchParams.get("projectId") ?? undefined;
  return NextResponse.json({
    ok: true,
    projects: projectId ? (getModelProject(projectId) ? [getModelProject(projectId)] : []) : listModelProjects(tenantId),
    trainingJobs: listTrainingJobs(projectId),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.kind === "model-project") {
      if (!body.tenantId || !body.name) return NextResponse.json({ error: "tenantId and name are required" }, { status: 400 });
      return NextResponse.json(createModelProject({
        tenantId: body.tenantId,
        name: body.name,
        baseModel: body.baseModel,
        datasetIds: body.datasetIds ?? [],
        runtimeNodeId: body.runtimeNodeId,
      }), { status: 201 });
    }

    if (body.kind === "training-job") {
      if (!body.projectId || !body.node || !body.image || !Array.isArray(body.command)) {
        return NextResponse.json({ error: "projectId, node, image, and command are required" }, { status: 400 });
      }
      const project = getModelProject(body.projectId);
      if (!project) return NextResponse.json({ error: "Model project not found" }, { status: 404 });
      const node = body.node as InfrastructureNode;
      const job = planTrainingJob({ project, node, image: body.image, command: body.command });
      return NextResponse.json(saveTrainingJob(job), { status: 202 });
    }

    return NextResponse.json({ error: "Unsupported AI resource kind" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid request" }, { status: 400 });
  }
}
