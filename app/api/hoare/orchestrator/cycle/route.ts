import { NextRequest, NextResponse } from "next/server";
import { AgenticOrchestratorLoop, type AgentLoopState } from "@/lib/hoare/orchestrator/agent-loop";
import { createRuntimeBackedLoopDependencies, type HoareAgentRuntime } from "@/lib/hoare/orchestrator/runtime-bridge";

export async function POST(request: NextRequest) {
  try {
    const state = (await request.json()) as AgentLoopState;
    if (!state || !Array.isArray(state.observations) || !Array.isArray(state.decisions)) {
      return NextResponse.json({ error: "A valid orchestrator state is required" }, { status: 400 });
    }

    const runtime = (globalThis as { __HOARE_AGENT_RUNTIME__?: HoareAgentRuntime }).__HOARE_AGENT_RUNTIME__;
    if (!runtime) {
      return NextResponse.json({ error: "HOARE agent runtime is not configured" }, { status: 503 });
    }

    const deps = createRuntimeBackedLoopDependencies(runtime);
    const loop = new AgenticOrchestratorLoop(deps.decisionEngine, deps.executor, deps.verifier);
    return NextResponse.json(await loop.runCycle(state));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run orchestration cycle" }, { status: 500 });
  }
}
