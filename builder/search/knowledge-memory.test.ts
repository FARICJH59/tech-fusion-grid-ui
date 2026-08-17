import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryMemoryProvider } from "../../packages/agent-sdk/src/memory";
import { persistKnowledgeAcquisition } from "./knowledge-memory";
import type { KnowledgeAcquisitionResult } from "./knowledge";
import type { AgentMemoryRuntime } from "../../agentfusion/memory/memory-runtime";

function result(): KnowledgeAcquisitionResult {
  return {
    query: "example query",
    acquired_at: "2026-08-16T00:00:00.000Z",
    provenance_hash: "bundle-provenance",
    candidates: [
      {
        id: "candidate-1",
        tenant_id: "tenant-a",
        project_id: "project-a",
        title: "Example knowledge",
        url: "https://example.com/article",
        snippet: "Example evidence",
        confidence_score: 0.82,
        provenance: {
          source: "https://example.com/article",
          source_class: "web",
          acquisition_method: "serpapi",
          acquired_at: "2026-08-16T00:00:00.000Z",
          license_status: "known-permitted",
          content_hash: "content-hash",
          evidence_id: "evidence-1",
          evidence_provenance_hash: "evidence-provenance",
        },
      },
    ],
  };
}

test("persists governed knowledge through the existing tenant memory boundary", async () => {
  const memory = new InMemoryMemoryProvider();
  const runtime = {
    writeTenantKnowledge: async (record: Parameters<AgentMemoryRuntime["writeTenantKnowledge"]>[0]) => {
      await memory.set({ ...record, tier: "long-term" });
    },
  } as AgentMemoryRuntime;

  const records = await persistKnowledgeAcquisition(result(), runtime);

  assert.equal(records.length, 1);
  assert.equal(records[0].tier, "long-term");
  assert.equal(records[0].tenantId, "tenant-a");
  assert.deepEqual(records[0].tags, [
    "knowledge",
    "provenance",
    "source:web",
    "license:known-permitted",
  ]);
  const stored = await memory.get({
    tenantId: "tenant-a",
    tier: "long-term",
    key: "knowledge:candidate-1",
  });
  assert.equal(stored?.tenantId, "tenant-a");
  assert.equal((stored?.value as { kind: string }).kind, "knowledge-candidate");
});
