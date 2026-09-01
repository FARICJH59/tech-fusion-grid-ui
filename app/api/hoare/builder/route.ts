import { NextRequest, NextResponse } from "next/server";
import { buildCapabilityPlan, type BuilderRequirements } from "@/lib/hoare/builder/capability-planner";
import { planBuilderIntent } from "@/lib/hoare/builder/planner";
import type { BuilderIntent } from "@/lib/hoare/builder/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<BuilderIntent> & {
      provider?: string;
      environment?: "development" | "staging" | "production";
      requirements?: BuilderRequirements;
    };

    if (!body.tenantId || !body.name || !body.description || !body.resources?.length) {
      return NextResponse.json({ error: "tenantId, name, description and resources are required" }, { status: 400 });
    }

    const plan = planBuilderIntent(
      {
        tenantId: body.tenantId,
        name: body.name,
        description: body.description,
        resources: body.resources,
      },
      body.provider,
      body.environment,
    );

    const capability = buildCapabilityPlan(plan, body.requirements);
    return NextResponse.json({ ...plan, capability }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create builder plan";
    const status = message.startsWith("INVALID_BUILDER_REQUIREMENT") || message.startsWith("CLASSIFIED_BUILDER_PLAN") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
