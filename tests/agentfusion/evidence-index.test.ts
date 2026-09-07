import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryFusionEvidenceIndex } from "../../agentfusion/fusion-search/index/in-memory-evidence-index";
import type { FusionEvidence } from "../../agentfusion/fusion-search/core/types";

const makeEvidence = (id: string, tenantId: string, observedAt: string, overrides: Partial<FusionEvidence> = {}): FusionEvidence => ({
  evidenceId: id,
  source: "test",
  sourceType: "execution",
  tenantId,
  projectId: "project-a",
  objectId: id,
  content: { agentId: "agent-a", workloadId: "workload-a", message: id },
  observedAt,
  indexedAt: observedAt,
  contentHash: `hash-${id}`,
  relevance: 1,
  confidence: 1,
  tags: ["ops", "verified"],
  provenance: {
    transactionId: `tx-${id}`,
    attemptId: `attempt-${id}`,
  },
  ...overrides,
});

test("evidence index isolates tenants", async () => {
  const index = new InMemoryFusionEvidenceIndex();
  await index.put(makeEvidence("a", "tenant-a", "2026-09-01T00:00:00.000Z"));
  await index.put(makeEvidence("b", "tenant-b", "2026-09-01T00:00:00.000Z"));

  const result = await index.search({ tenantId: "tenant-a" });
  assert.deepEqual(result.map((item) => item.evidenceId), ["a"]);

  await assert.rejects(
    () => index.delete("b", "tenant-a"),
    /fusion_search_cross_tenant_evidence/,
  );
});

test("evidence index applies structured and temporal filters", async () => {
  const index = new InMemoryFusionEvidenceIndex();
  await index.put(makeEvidence("old", "tenant-a", "2026-09-01T00:00:00.000Z"));
  await index.put(makeEvidence("new", "tenant-a", "2026-09-06T00:00:00.000Z", {
    content: { agentId: "agent-b", workloadId: "workload-b", message: "new" },
    tags: ["security", "verified"],
  }));

  const result = await index.search({
    tenantId: "tenant-a",
    agentId: "agent-b",
    workloadId: "workload-b",
    tags: ["security"],
    observedFrom: "2026-09-05T00:00:00.000Z",
    observedTo: "2026-09-07T00:00:00.000Z",
  });

  assert.deepEqual(result.map((item) => item.evidenceId), ["new"]);
});

test("evidence index rejects invalid ranges and conflicting versions", async () => {
  const index = new InMemoryFusionEvidenceIndex();
  await index.put(makeEvidence("a", "tenant-a", "2026-09-01T00:00:00.000Z"));

  await assert.rejects(
    () => index.search({
      tenantId: "tenant-a",
      observedFrom: "2026-09-07T00:00:00.000Z",
      observedTo: "2026-09-01T00:00:00.000Z",
    }),
    /fusion_search_invalid_observed_range/,
  );

  await assert.rejects(
    () => index.put(makeEvidence("a", "tenant-a", "2026-09-01T00:00:00.000Z", { contentHash: "different" })),
    /fusion_search_evidence_version_conflict/,
  );
});

test("evidence index provides deterministic ranking for equal scores", async () => {
  const index = new InMemoryFusionEvidenceIndex();
  await index.put(makeEvidence("z", "tenant-a", "2026-09-01T00:00:00.000Z"));
  await index.put(makeEvidence("a", "tenant-a", "2026-09-02T00:00:00.000Z"));

  const result = await index.search({ tenantId: "tenant-a", limit: 1 });
  assert.deepEqual(result.map((item) => item.evidenceId), ["a"]);
});
