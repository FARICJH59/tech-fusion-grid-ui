import { NextRequest, NextResponse } from "next/server";
import { transitionBuilderPlan, type BuilderLifecycleAction } from "@/lib/hoare/builder/engine";
import type { BuilderPlan } from "@/lib/hoare/builder/types";

const ACTIONS: BuilderLifecycleAction[] = ["approve", "start", "complete", "fail"];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { plan?: BuilderPlan; action?: BuilderLifecycleAction };
    if (!body.plan || !body.action || !ACTIONS.includes(body.action)) {
      return NextResponse.json(
        { error: "plan and a valid action (approve, start, complete, fail) are required" },
        { status: 400 },
      );
    }

    const result = transitionBuilderPlan(body.plan, body.action);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to transition builder plan" },
      { status: 409 },
    );
  }
}
