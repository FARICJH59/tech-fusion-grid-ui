import test from "node:test";
import assert from "node:assert/strict";

import { AgentRuntimeEventBus, AGENT_RUNTIME_EVENT_NAMES } from "../../agentfusion/runtime/agent-events";
import { autonomousEventBus } from "../../lib/events/event-bus";

test("agent runtime events publish through the existing event bus", async () => {
  const events = new AgentRuntimeEventBus();
  await events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentRegistered, {
    agentId: "agent-1",
    tenantId: "tenant-1",
    payload: { status: "REGISTERED" },
  });

  const replay = await autonomousEventBus.replay({
    tenantId: "tenant-1",
    organizationId: "tenant-1",
    types: ["agent-registered"],
    limit: 5,
  });

  assert.equal(replay[0]?.type, "agent-registered");
  assert.equal(events.list()[0]?.name, "AgentRegistered");
});

test("validated lifecycle events bridge to platform event bus", async () => {
  const events = new AgentRuntimeEventBus();
  await events.emit(AGENT_RUNTIME_EVENT_NAMES.AgentValidated, {
    agentId: "agent-2",
    tenantId: "tenant-2",
    payload: { status: "VALIDATED" },
  });

  const replay = await autonomousEventBus.replay({
    tenantId: "tenant-2",
    organizationId: "tenant-2",
    types: ["agent-validated"],
    limit: 5,
  });

  assert.equal(replay[0]?.type, "agent-validated");
  assert.equal(events.list()[0]?.name, "AgentValidated");
});
