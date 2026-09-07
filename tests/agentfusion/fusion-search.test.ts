import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryMemoryProvider } from "../../packages/agent-sdk/src/memory";
import { AgentFusionMemorySearchProvider } from "../../agentfusion/fusion-search/providers/memory-provider";
import { EvidenceFusionEngine } from "../../agentfusion/fusion-search/fusion/evidence-fusion";
import type { FusionEvidence, FusionSearchProvider } from "../../agentfusion/fusion-search/core/types";

const context = { tenantId: "tenant-a", projectId: "project-a", agentId: "agent-a" } as const;

async function seededMemory(): Promise<InMemoryMemoryProvider> {
  const memory = new InMemoryMemoryProvider();
  await memory.set({
    key: "execution-1",
    value: { transactionId: "tx-1", attemptId: "attempt-1", message: "drone stability wind test failed" },
    tier: "long-term",
    tenantId: "tenant-a",
    agentId: "agent-a",
    updatedAt: "2026-09-07T10:00:00.000Z",
    tags: ["execution", "drone"],
  });
  await memory.set({
    key: "foreign",
    value: { transactionId: "tx-foreign", message: "drone stability wind test failed" },
    tier: "long-term",
    tenantId: "tenant-b",
    agentId: "agent-b",
    updatedAt: "2026-09-07T10:01:00.000Z",
  });
  return memory;
}

test("Fusion Search rejects tenant mismatch before provider access", async () => {
  const provider: FusionSearchProvider = {
    name: "test",
    async search(): Promise<readonly FusionEvidence[]> {
      throw new Error("provider must not be reached");
    },
  };
  const engine = new EvidenceFusionEngine([provider]);
  await assert.rejects(
    engine.search({ query: "secret", tenantId: "tenant-b" }, context),
    /fusion_search_tenant_mismatch/,
  );
});

test("memory provider returns only evidence owned by the request tenant", async () => {
  const provider = new AgentFusionMemorySearchProvider(await seededMemory());
  const results = await provider.search({ query: "drone stability wind", tenantId: "tenant-a" }, context);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.tenantId, "tenant-a");
  assert.equal(results[0]?.objectId, "execution-1");
});

test("evidence fusion fails closed if a provider returns foreign-tenant evidence", async () => {
  const foreign: FusionSearchProvider = {
    name: "bad-provider",
    async search(): Promise<readonly FusionEvidence[]> {
      return [{
        evidenceId: "foreign:1",
        source: "bad-provider",
        sourceType: "test",
        tenantId: "tenant-b",
        objectId: "foreign",
        content: "must never escape",
        observedAt: "2026-09-07T10:00:00.000Z",
        indexedAt: "2026-09-07T10:00:00.000Z",
        contentHash: "abc",
        relevance: 1,
        confidence: 1,
        provenance: {},
      }];
    },
  };
  const engine = new EvidenceFusionEngine([foreign]);
  await assert.rejects(
    engine.search({ query: "anything", tenantId: "tenant-a" }, context),
    /fusion_search_cross_tenant_evidence/,
  );
});

test("hybrid fusion deduplicates and ranks evidence", async () => {
  const provider = new AgentFusionMemorySearchProvider(await seededMemory());
  const second: FusionSearchProvider = {
    name: "second",
    async search(): Promise<readonly FusionEvidence[]> {
      return [{
        evidenceId: "second:1",
        source: "second",
        sourceType: "test",
        tenantId: "tenant-a",
        objectId: "second",
        content: "wind telemetry",
        observedAt: "2026-09-07T10:02:00.000Z",
        indexedAt: "2026-09-07T10:02:00.000Z",
        contentHash: "def",
        relevance: 0.8,
        confidence: 0.9,
        provenance: { transactionId: "tx-1", attemptId: "attempt-1" },
      }];
    },
  };
  const engine = new EvidenceFusionEngine([provider, second]);
  const response = await engine.search({ query: "drone stability wind", tenantId: "tenant-a", limit: 10 }, context);
  assert.equal(response.evidence.length, 2);
  assert.equal(response.providers.length, 2);
  assert.equal(response.evidence[0]?.tenantId, "tenant-a");
});
