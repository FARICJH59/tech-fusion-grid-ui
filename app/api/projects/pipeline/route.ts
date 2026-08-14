import { NextResponse, type NextRequest } from "next/server";
import { extractBearerToken, verifyToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { resolveEntitlements, type SubscriptionTier } from "@/lib/enterprise/entitlements";
import { runProjectPipeline } from "@/lib/integrations/project-pipeline";

type SubscriptionRow = { plan_tier: SubscriptionTier; status: string };
type CreditRow = { credit_delta: number; type: string };

async function tenantEntitlements(tenantId: string, role: Parameters<typeof resolveEntitlements>[2]) {
  if (!supabaseAdmin) return resolveEntitlements("free", 0, role);
  const { data: subscriptions } = await supabaseAdmin.from("subscriptions").select("plan_tier, status").eq("tenant_id", tenantId).eq("status", "active").order("created_at", { ascending: false }).limit(1).returns<SubscriptionRow[]>();
  const tier: SubscriptionTier = subscriptions?.[0]?.plan_tier ?? "free";
  const { data: creditEvents } = await supabaseAdmin.from("credit_ledger").select("credit_delta, type").eq("tenant_id", tenantId).returns<CreditRow[]>();
  const credits = (creditEvents ?? []).reduce((total, event) => {
    if (event.type === "purchase" || event.type === "grant") return total + Math.abs(event.credit_delta);
    if (event.type === "consume") return total - Math.abs(event.credit_delta);
    return total + event.credit_delta;
  }, 0);
  return resolveEntitlements(tier, Math.max(credits, 0), role);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = extractBearerToken(req.headers.get("authorization"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let user;
  try { user = verifyToken(token); } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (!supabaseAdmin) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  const entitlements = await tenantEntitlements(user.tenantId, user.role);
  if (!entitlements.features.aiOrchestration) {
    return NextResponse.json({ error: "AI orchestration is not entitled for this tenant" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { projectId?: string; repository?: string; sourceSha?: string } | null;
  if (!body?.projectId || !body.repository || !body.sourceSha) {
    return NextResponse.json({ error: "projectId, repository and sourceSha are required" }, { status: 400 });
  }

  const { data: project } = await supabaseAdmin.from("projects").select("id, tenant_id").eq("id", body.projectId).eq("tenant_id", user.tenantId).maybeSingle();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const results = await runProjectPipeline({ tenantId: user.tenantId, projectId: project.id as string, repository: body.repository, sourceSha: body.sourceSha });
  const blockedOrFailed = results.find((result) => result.status !== "passed");

  await supabaseAdmin.from("project_pipeline_runs").insert(results.map((result) => ({
    tenant_id: user.tenantId,
    project_id: project.id,
    stage: result.stage,
    status: result.status === "passed" ? "passed" : result.status,
    request_id: result.requestId ?? null,
    artifact_ref: result.artifactRef ?? null,
    result: result.result ?? {},
  })));

  return NextResponse.json({
    tenant_id: user.tenantId,
    project_id: project.id,
    results,
    deployment_allowed: !blockedOrFailed && entitlements.features.cloudDeployments,
    entitlement: { ai_orchestration: entitlements.features.aiOrchestration, cloud_deployments: entitlements.features.cloudDeployments },
  }, { status: blockedOrFailed ? 409 : 200 });
}
