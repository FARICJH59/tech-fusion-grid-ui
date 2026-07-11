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
