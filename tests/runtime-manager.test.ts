import test from "node:test";
import assert from "node:assert/strict";

import { RuntimeManager } from "../lib/runtime/manager";
import type { AgentDefinition, ToolDefinition, WorkflowDefinition } from "../lib/runtime/types";

test("runtime-manager: starts in stopped state", () => {
  const manager = new RuntimeManager();
  assert.equal(manager.getState(), "stopped");
});

test("runtime-manager: transitions to running after start", async () => {
  const manager = new RuntimeManager();
  await manager.start();
  assert.equal(manager.getState(), "running");
  await manager.stop();
});

test("runtime-manager: registries accept definitions after start", async () => {
  const manager = new RuntimeManager();
  await manager.start();

  const agent: AgentDefinition = {
    id: "agent-a",
    name: "Agent A",
    version: "1.0.0",
    description: "test agent",
    capabilities: ["run"],
    execute: async () => ({ result: "ok" }),
  };
  const tool: ToolDefinition<{ value: number }, { doubled: number }> = {
    id: "tool-a",
    version: "1.0.0",
    name: "Tool A",
    description: "test tool",
    execute: async (input) => ({ doubled: input.value * 2 }),
  };
  const workflow: WorkflowDefinition = {
    id: "workflow-a",
    name: "Workflow A",
    version: "1.0.0",
    steps: [{ id: "step-a", name: "Step A", toolId: "tool-a" }],
  };

  manager.agents.register(agent);
  manager.tools.register(tool);
  manager.workflows.register(workflow);

  assert.equal(manager.agents.count(), 1);
  assert.equal(manager.tools.count(), 1);
  assert.equal(manager.workflows.count(), 1);

  await manager.stop();
});

test("runtime-manager: createContext carries tenant and correlation identifiers", async () => {
  const manager = new RuntimeManager();
  await manager.start();

  const ctx = manager.createContext("tenant-1", "corr-1");
  assert.equal(ctx.tenantId, "tenant-1");
  assert.equal(ctx.correlationId, "corr-1");

  await manager.stop();
});

test("runtime-manager: stop transitions back to stopped", async () => {
  const manager = new RuntimeManager();
  await manager.start();
  await manager.stop();
  assert.equal(manager.getState(), "stopped");
});
