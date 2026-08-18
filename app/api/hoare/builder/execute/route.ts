import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { buildDefaultExecutor } from "@/lib/hoare/builder/executor";
import { SupabaseBuilderPlanRepository } from "@/lib/hoare/builder/plan-repository-supabase";
import { HoareBuilderActionService } from "@/lib/hoare/orchestrator/builder-action-service";
import { TrustedGatewayIdentityAdapter } from "@/lib/hoare/identity/request-adapter";
import { assertPrincipal } from "@/lib/hoare/identity/types";

const plans = new SupabaseBuilderPlanRepository(supabase);
const executor = buildDefaultExecutor();
const actions = new HoareBuilderActionService(plans, executor);
const identity = new TrustedGatewayIdentityAdapter();

export async function POST(request: NextRequest) {
  try {
    const principal = assertPrincipal(await identity.authenticate(request));
    const body = (await request.json()) as { planId?: string };

    if (!body?.planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    const result = await actions.build(body.planId, principal.tenantId);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute builder plan";
    const status = message.includes("Unauthenticated") ? 401 :
      message.includes("not found") || message.includes("must be approved") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
