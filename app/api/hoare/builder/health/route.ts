import { NextRequest, NextResponse } from "next/server";
import { evaluateExecutionHealth } from "@/lib/hoare/builder/health";
import type { BuilderPlan } from "@/lib/hoare/builder/types";
import type { ExecutionJournal } from "@/lib/hoare/builder/operations";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { plan?: BuilderPlan; journal?: ExecutionJournal };
    if (!body.plan || !body.journal) {
      return NextResponse.json({ error: "plan and journal are required" }, { status: 400 });
    }
    return NextResponse.json(evaluateExecutionHealth(body.plan, body.journal));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to evaluate health" }, { status: 500 });
  }
}
