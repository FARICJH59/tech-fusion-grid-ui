import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidenceGraph } from "../../agentfusion/fusion-search/fusion/evidence-graph";
import type { FusionEvidence } from "../../agentfusion/fusion-search/core/types";

const evidence = (id: string, transactionId: string, attemptId: string, artifactDigest: string): FusionEvidence => ({
  evidenceId: id,
  source: "test",
  sourceType: "test",
  tenantId: "tenant-a",
  objectId: id,
  content: { transactionId, attemptId },
  observedAt: "2026-09-07T10:00:00.000Z",
  indexedAt: "2026-09-07T10:00:00.000Z",
  contentHash: id,
  relevance: 1,
  confidence: 1,
  provenance: { transactionId, attemptId, artifactDigest },
});

test("evidence graph links transaction, attempt, and artifact relationships", () => {
  const graph = buildEvidenceGraph([
    evidence("a", "tx-1", "attempt-1", "artifact-1"),
    evidence("b", "tx-1", "attempt-1", "artifact-1"),
  ], "tenant-a");

  assert.equal(graph.nodes.length, 2);
  assert.ok(graph.edges.some((edge) => edge.relation === "same-transaction"));
  assert.ok(graph.edges.some((edge) => edge.relation === "same-attempt"));
  assert.ok(graph.edges.some((edge) => edge.relation === "same-artifact"));
  assert.match(graph.graphHash, /^[a-f0-9]{64}$/);
});

test("evidence graph fails closed on mixed-tenant evidence", () => {
  assert.throws(
    () => buildEvidenceGraph([
      evidence("a", "tx-1", "attempt-1", "artifact-1"),
      { ...evidence("foreign", "tx-2", "attempt-2", "artifact-2"), tenantId: "tenant-b" },
    ], "tenant-a"),
    /fusion_search_cross_tenant_evidence/,
  );
});
