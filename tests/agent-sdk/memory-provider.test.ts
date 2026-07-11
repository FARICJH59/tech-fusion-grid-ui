import test from "node:test";
import assert from "node:assert/strict";

import { InMemoryMemoryProvider } from "../../packages/agent-sdk/src";

test("memory provider supports short-term and long-term retrieval without new infrastructure", async () => {
  const provider = new InMemoryMemoryProvider();

  await provider.set({
    key: "session-state",
    value: { stage: "planning" },
    tier: "short-term",
    tenantId: "tenant-1",
    agentId: "agent-1",
    sessionId: "session-1",
    updatedAt: new Date().toISOString(),
    tags: ["workflow"],
  });
  await provider.set({
    key: "tenant-preference",
    value: { locale: "en-US" },
    tier: "long-term",
    tenantId: "tenant-1",
    agentId: "agent-1",
    updatedAt: new Date().toISOString(),
    tags: ["preferences"],
  });

  assert.equal((await provider.get({ key: "session-state", sessionId: "session-1" }))?.tier, "short-term");
  assert.equal((await provider.search({ tenantId: "tenant-1", tags: ["preferences"] })).length, 1);
  assert.equal(await provider.delete({ key: "session-state", sessionId: "session-1" }), true);
});
