import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryMemoryProvider } from "../../packages/agent-sdk/src/memory";
import { AgentMemoryRuntime } from "../../agentfusion/memory/memory-runtime";
import { retrieveKnowledge } from "./knowledge-retrieval";
import { buildKnowledgeAgentContext } from "./knowledge-context";

function memoryRuntime(): AgentMemoryRuntime {
  const runtime = new AgentMemoryRuntime();
  const provider = new InMemoryMemoryProvider();
  Object.assign(runtime, { longTerm: provider });
  return runtime;
}

function record(tenantId: string, id: string, title: string, confidence: number) {
  return {
    key: `knowledge:${id}`,
    tier: "long-term" as const,
    tenantId,
    updatedAt: new Date().toISOString(),
    tags: ["knowledge", "provenance", "source:web", "license:known-permitted"],
    value: {
      kind: "knowledge-candidate" as const,
      title,
      snippet: `${title} evidence`,
      confidence_score: confidence,
      provenance: {
        source: `https://example.com/${id}`,
        source_class: "web" as const,
        acquisition_method: "serpapi",
        acquired_at: new Date().toISOString(),
        license_status: "known-permitted" as const,
        content_hash: `content-${id}`,
        evidence_id: `evidence-${id}`,
        evidence_provenance_hash: `provenance-${id}`,
      },
    },
  };
}

test("retrieves only tenant-scoped knowledge and ranks lexical matches", async () => {
  const runtime = memoryRuntime();
  await runtime.writeTenantKnowledge(record("tenant-a", "one", "grid battery storage", 0.9));
  await runtime.writeTenantKnowledge(record("tenant-a", "two", "unrelated finance", 0.99));
  await runtime.writeTenantKnowledge(record("tenant-b", "three", "grid battery storage", 1));

  const result = await retrieveKnowledge({
    tenant_id: "tenant-a",
    query: "battery storage",
    top_k: 5,
  }, runtime);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].record.tenantId, "tenant-a");
  assert.equal(result.items[0].knowledge.title, "grid battery storage");
  assert.ok(result.items[0].score > 0);

  const context = buildKnowledgeAgentContext(result);
  assert.equal(context.tenant_id, "tenant-a");
  assert.equal(context.evidence[0].evidence_id, "evidence-one");
  assert.deepEqual(context.provenance_hashes, ["provenance-one"]);
});
