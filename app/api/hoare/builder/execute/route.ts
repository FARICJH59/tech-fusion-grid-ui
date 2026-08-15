import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildDefaultExecutor } from "@/lib/hoare/builder/executor";
import { SupabaseBuilderPlanRepository } from "@/lib/hoare/builder/plan-repository-supabase";
import { HoareBuilderActionService } from "@/lib/hoare/orchestrator/builder-action-service";

const plans = new SupabaseBuilderPlanRepository(supabase);
const executor = buildDefaultExecutor();
const actions = new HoareBuilderActionService(plans, executor);

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { planId?: string; tenantId?: string };

    if (!body?.planId || !body?.tenantId) {
      return NextResponse.json(
        { error: "planId and tenantId are required" },
        { status: 400 },
      );
    }

    const result = await actions.build(body.planId, body.tenantId);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute builder plan";
    const status = message.includes("not found") || message.includes("must be approved") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
