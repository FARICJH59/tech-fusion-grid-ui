import { NextRequest, NextResponse } from "next/server";
import { HoareAgenticOrchestrator } from "@/lib/hoare/orchestrator/agentic-orchestrator";
import { buildDefaultExecutor } from "@/lib/hoare/builder/executor";
import type { BuilderIntent } from "@/lib/hoare/builder/types";
import type { BuilderPolicy } from "@/lib/hoare/builder/policy";

const orchestrator = new HoareAgenticOrchestrator(buildDefaultExecutor());

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      intent?: BuilderIntent;
      provider?: string;
      environment?: BuilderIntent extends never ? never : "development" | "staging" | "production";
      policy?: BuilderPolicy;
    };

    if (!body.intent?.tenantId || !body.intent?.name || !body.intent?.resources?.length) {
      return NextResponse.json({ error: "intent with tenantId, name, and resources is required" }, { status: 400 });
    }

    const result = await orchestrator.run({
      intent: body.intent,
      provider: body.provider,
      environment: body.environment,
      policy: body.policy,
    });

    return NextResponse.json(result, { status: result.phase === "blocked" ? 403 : 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to orchestrate request" },
      { status: 500 },
    );
  }
}
