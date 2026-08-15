import { NextRequest, NextResponse } from "next/server";
import type { BuilderPlan } from "@/lib/hoare/builder/types";
import { buildDefaultExecutor } from "@/lib/hoare/builder/executor";

const executor = buildDefaultExecutor();

export async function POST(request: NextRequest) {
  try {
    const plan = (await request.json()) as BuilderPlan;
    if (!plan?.id || !plan?.resources || !plan?.deployment) {
      return NextResponse.json({ error: "A complete builder plan is required" }, { status: 400 });
    }

    const result = await executor.execute(plan);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to execute builder plan" },
      { status: 400 },
    );
  }
}
