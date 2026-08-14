import { NextResponse, type NextRequest } from "next/server";
import { extractBearerToken, verifyToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { importGitHubRepository } from "@/lib/integrations/github-import";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let user;
  try {
    user = verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { repository?: string; projectName?: string } | null;
  if (!body?.repository) {
    return NextResponse.json({ error: "repository is required" }, { status: 400 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    const imported = await importGitHubRepository(body.repository);
    const projectName = body.projectName?.trim() || imported.repository.name;
    const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || `github-${imported.repository.id}`;

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .upsert(
        {
          tenant_id: user.tenantId,
          name: projectName,
          slug,
          source_type: "github",
          status: "active",
        },
        { onConflict: "tenant_id,slug" },
      )
      .select("id, tenant_id, name, slug, status")
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: projectError?.message ?? "Project creation failed" }, { status: 500 });
    }

    const { error: sourceError } = await supabaseAdmin
      .from("github_project_sources")
      .upsert(
        {
          project_id: project.id,
          tenant_id: user.tenantId,
          repository_id: imported.repository.id,
          owner_login: imported.repository.owner.login,
          repository_name: imported.repository.name,
          repository_full_name: imported.repository.full_name,
          default_branch: imported.repository.default_branch ?? "main",
          source_sha: imported.source_sha,
          metadata: { private: Boolean(imported.repository.private), html_url: imported.repository.html_url ?? null },
        },
        { onConflict: "tenant_id,repository_id" },
      );

    if (sourceError) {
      return NextResponse.json({ error: sourceError.message }, { status: 500 });
    }

    return NextResponse.json({
      project,
      source: {
        provider: "github",
        repository_id: imported.repository.id,
        repository: imported.repository.full_name,
        default_branch: imported.repository.default_branch ?? "main",
        source_sha: imported.source_sha,
      },
      next: "pasor",
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "GitHub import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
