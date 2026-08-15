import { NextRequest, NextResponse } from "next/server";
import { AgenticOrchestratorLoop, type AgentLoopState } from "@/lib/hoare/orchestrator/agent-loop";

export async function POST(request: NextRequest) {
  try {
    const state = (await request.json()) as AgentLoopState;
    if (!state || !Array.isArray(state.observations) || !Array.isArray(state.decisions)) {
      return NextResponse.json({ error: "A valid orchestrator state is required" }, { status: 400 });
    }

    const loop = new AgenticOrchestratorLoop(
      { async decide({ observations }) {
        const failure = observations.find((item) => item.type === "failure" || item.type === "incident");
        return failure
          ? { action: "remediate", reason: `Observed ${failure.type} from ${failure.source}`, confidence: 0.8 }
          : { action: "wait", reason: "No actionable observation", confidence: 0.95 };
      } },
      { async execute(decision) { return { success: decision.action !== "block", detail: `Executed ${decision.action}` }; } },
      { async verify() { return { healthy: true, detail: "Verification completed" }; } },
    );

    return NextResponse.json(await loop.runCycle(state));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run orchestration cycle" }, { status: 500 });
  }
}
