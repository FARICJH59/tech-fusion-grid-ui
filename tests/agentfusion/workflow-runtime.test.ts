import test from "node:test";
import assert from "node:assert/strict";

import { AgentWorkflowRuntime } from "../../agentfusion/workflows/workflow-runtime";

const workflow = {
  id: "customer-request",
  name: "Customer Request",
  version: "1.0.0",
  description: "",
  collaborationMode: "multi-agent" as const,
  approvalMode: "manual" as const,
  eventStrategy: "emit-per-step" as const,
  steps: [
    { id: "coordinator", name: "Coordinator", type: "task" as const },
    { id: "style", name: "Style", type: "agent" as const, dependsOn: ["coordinator"], metadata: { parallelGroup: "advisors" } },
    { id: "beauty", name: "Beauty", type: "agent" as const, dependsOn: ["coordinator"], metadata: { parallelGroup: "advisors" } },
    { id: "approval", name: "Approval", type: "approval" as const, dependsOn: ["style", "beauty"], requiresApproval: true },
    { id: "respond", name: "Respond", type: "event" as const, dependsOn: ["approval"] },
  ],
};

test("workflow runtime executes sequential, parallel, and approval-aware steps", async () => {
  const runtime = new AgentWorkflowRuntime();
  const visited: string[] = [];
  const result = await runtime.execute({
    workflow,
    agentId: "coordinator-agent",
    tenantId: "tenant-1",
    executeStep: async (step) => {
      visited.push(step.id);
      return step.id;
    },
    approvalGate: async () => true,
  });

  assert.equal(result.status, "completed");
  assert.ok(visited.indexOf("style") >= 0 && visited.indexOf("beauty") >= 0);
  assert.equal(result.steps.at(-1)?.stepId, "respond");
});
