import { NextResponse, type NextRequest } from "next/server";
import { extractBearerToken, verifyToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { runProjectPipeline } from "@/lib/integrations/project-pipeline";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user;
  try {
    user = verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    projectId?: string;
    repository?: string;
    sourceSha?: string;
  } | null;

  if (!body?.projectId || !body.repository || !body.sourceSha) {
    return NextResponse.json({ error: "projectId, repository and sourceSha are required" }, { status: 400 });
  }

  if (!supabaseAdmin) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, tenant_id")
    .eq("id", body.projectId)
    .eq("tenant_id", user.tenantId)
    .maybeSingle();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const context = {
    tenantId: user.tenantId,
    projectId: project.id as string,
    repository: body.repository,
    sourceSha: body.sourceSha,
  };

  const results = await runProjectPipeline(context);
  const blockedOrFailed = results.find((result) => result.status !== "passed");

  await supabaseAdmin.from("project_pipeline_runs").insert(
    results.map((result) => ({
      tenant_id: user.tenantId,
      project_id: project.id,
      stage: result.stage,
      status: result.status === "passed" ? "passed" : result.status,
      request_id: result.requestId ?? null,
      artifact_ref: result.artifactRef ?? null,
      result: result.result ?? {},
    })),
  );

  return NextResponse.json(
    {
      tenant_id: user.tenantId,
      project_id: project.id,
      results,
      deployment_allowed: !blockedOrFailed,
    },
    { status: blockedOrFailed ? 409 : 200 },
  );
}
