import { NextRequest, NextResponse } from "next/server";
import { planBuilderIntent } from "@/lib/hoare/builder/planner";
import type { BuilderIntent } from "@/lib/hoare/builder/types";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<BuilderIntent> & { provider?: string; environment?: "development" | "staging" | "production" };
    if (!body.tenantId || !body.name || !body.description || !body.resources?.length) {
      return NextResponse.json({ error: "tenantId, name, description and resources are required" }, { status: 400 });
    }
    const plan = planBuilderIntent({ tenantId: body.tenantId, name: body.name, description: body.description, resources: body.resources }, body.provider, body.environment);
    return NextResponse.json(plan, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create builder plan" }, { status: 500 });
  }
}
