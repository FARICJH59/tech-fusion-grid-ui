import test from "node:test";
import assert from "node:assert/strict";

import { AgentMemoryRuntime } from "../../agentfusion/memory/memory-runtime";

test("memory runtime stores short-term context and long-term tenant knowledge without new storage systems", async () => {
  const memory = new AgentMemoryRuntime();
  await memory.writeExecutionContext({ key: "ctx", value: { request: 1 }, tenantId: "tenant-1", agentId: "a1", sessionId: "s1", updatedAt: new Date().toISOString() });
  await memory.writeTenantKnowledge({ key: "prefs", value: { style: "modern" }, tenantId: "tenant-1", agentId: "a1", updatedAt: new Date().toISOString() });

  const shortTerm = await memory.shortTerm.get({ tenantId: "tenant-1", agentId: "a1", sessionId: "s1", key: "ctx", tier: "short-term" });
  const longTerm = await memory.longTerm.get({ tenantId: "tenant-1", agentId: "a1", key: "prefs", tier: "long-term" });

  assert.deepEqual(shortTerm?.value, { request: 1 });
  assert.deepEqual(longTerm?.value, { style: "modern" });
});
