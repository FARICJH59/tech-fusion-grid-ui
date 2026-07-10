import test from "node:test";
import assert from "node:assert/strict";

import { AgentRegistry } from "../lib/runtime/agent-registry";
import { createRuntimeContext } from "../lib/runtime/context";
import { InMemoryEventBus } from "../lib/runtime/event-bus";
import { ExecutionEngine } from "../lib/runtime/execution-engine";
import { ExecutionQueue } from "../lib/runtime/execution-queue";
import { ToolRegistry } from "../lib/runtime/tool-registry";
import { WorkflowRegistry } from "../lib/runtime/workflow-registry";
import type { ExecutionRequest, ToolDefinition } from "../lib/runtime/types";

function createEngine() {
  const agents = new AgentRegistry();
  const tools = new ToolRegistry();
  const workflows = new WorkflowRegistry();
  const bus = new InMemoryEventBus();
  const queue = new ExecutionQueue();
  const engine = new ExecutionEngine({ agents, tools, workflows }, bus, queue);
  const ctx = createRuntimeContext("tenant-a", "corr-a", {
    getAgent: (id) => agents.get(id),
    getTool: (id, version) => tools.get(id, version),
    getWorkflow: (id) => workflows.get(id),
    emit: (event) => bus.emit(event),
  });

  return { agents, tools, workflows, bus, queue, engine, ctx };
}

function request(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
  return {
    type: "tool",
    targetId: "tool-a",
    tenantId: "tenant-a",
    input: { value: 21 },
    ...overrides,
  };
}

test("execution-engine: executes a tool and returns result", async () => {
  const { engine, tools, ctx } = createEngine();
  const tool: ToolDefinition<{ value: number }, { doubled: number }> = {
    id: "tool-a",
    version: "1.0.0",
    name: "Tool A",
    description: "test tool",
    execute: async (input) => ({ doubled: input.value * 2 }),
  };
  tools.register(tool);

  const result = await engine.execute(request(), ctx);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.output, { doubled: 42 });
});

test("execution-engine: respects idempotency key", async () => {
  const { engine, tools, ctx } = createEngine();
  let executions = 0;
  tools.register({
    id: "tool-a",
    version: "1.0.0",
    name: "Tool A",
    description: "test tool",
    execute: async () => {
      executions += 1;
      return { executions };
    },
  });

  const first = await engine.execute(request({ idempotencyKey: "same" }), ctx);
  const second = await engine.execute(request({ idempotencyKey: "same" }), ctx);

  assert.equal(executions, 1);
  assert.deepEqual(second.output, first.output);
});

test("execution-engine: retries on failure and eventually succeeds", async () => {
  const { engine, tools, ctx } = createEngine();
  let attempts = 0;
  tools.register({
    id: "tool-a",
    version: "1.0.0",
    name: "Tool A",
    description: "test tool",
    execute: async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("transient");
      }
      return { ok: true };
    },
  });

  const result = await engine.execute(request({ retries: 3 }), ctx);
  assert.equal(result.status, "completed");
  assert.equal(attempts, 3);
  assert.equal(result.attempts, 3);
});

test("execution-engine: emits execution.started and execution.completed events", async () => {
  const { engine, tools, ctx, bus } = createEngine();
  const seen: string[] = [];
  bus.on("execution.started", (event) => {
    seen.push(event.type);
  });
  bus.on("execution.completed", (event) => {
    seen.push(event.type);
  });

  tools.register({
    id: "tool-a",
    version: "1.0.0",
    name: "Tool A",
    description: "test tool",
    execute: async () => ({ ok: true }),
  });

  await engine.execute(request(), ctx);
  assert.deepEqual(seen, ["execution.started", "execution.completed"]);
});

test("execution-engine: returns failed result when all retries exhausted", async () => {
  const { engine, tools, ctx } = createEngine();
  tools.register({
    id: "tool-a",
    version: "1.0.0",
    name: "Tool A",
    description: "test tool",
    execute: async () => {
      throw new Error("still failing");
    },
  });

  const result = await engine.execute(request({ retries: 2 }), ctx);
  assert.equal(result.status, "failed");
  assert.match(result.error ?? "", /still failing/);
  assert.equal(result.attempts, 3);
});

test("execution-engine: timeout produces timeout result", async () => {
  const { engine, tools, ctx } = createEngine();
  tools.register({
    id: "tool-a",
    version: "1.0.0",
    name: "Tool A",
    description: "test tool",
    execute: async () => new Promise((resolve) => setTimeout(() => resolve({ ok: true }), 50)),
  });

  const result = await engine.execute(request({ timeoutMs: 5 }), ctx);
  assert.equal(result.status, "timeout");
  assert.match(result.error ?? "", /timed out/);
});
