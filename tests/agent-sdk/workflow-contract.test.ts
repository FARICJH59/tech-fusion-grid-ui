import test from "node:test";
import assert from "node:assert/strict";

import { WorkflowRegistry } from "../../packages/agent-sdk/src";

test("workflow contract validates multi-step execution, collaboration, approval, and events", () => {
  const registry = new WorkflowRegistry();

  const workflow = {
    id: "runtime-remediation",
    name: "Runtime Remediation",
    version: "1.0.0",
    description: "Coordinates remediation across tools and human approval.",
    collaborationMode: "multi-agent" as const,
    approvalMode: "policy-based" as const,
    eventStrategy: "emit-per-step" as const,
    steps: [
      { id: "analyze", name: "Analyze", type: "task" as const },
      { id: "tool-call", name: "Tool Call", type: "tool" as const, dependsOn: ["analyze"], toolId: "dispatcher" },
      { id: "approval", name: "Approval", type: "approval" as const, dependsOn: ["tool-call"], requiresApproval: true },
      { id: "notify", name: "Notify", type: "event" as const, dependsOn: ["approval"], emits: ["workflow.completed"] },
    ],
  };

  const validation = registry.register(workflow);

  assert.equal(validation.valid, true);
  assert.equal(registry.get("runtime-remediation")?.steps.length, 4);
});
