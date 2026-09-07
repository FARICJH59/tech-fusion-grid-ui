import assert from "node:assert/strict";
import test from "node:test";
import Redis from "ioredis";
import type { FusionEvidence } from "../../agentfusion/fusion-search/core/types";
import { RedisFusionEvidenceIndex } from "../../agentfusion/fusion-search/index/redis-evidence-index";

const redisUrl = process.env.REDIS_URL;

test("Redis evidence index atomically maintains secondary indexes", { skip: !redisUrl }, async () => {
  const redis = new Redis(redisUrl!);
  const prefix = `fusion:evidence:test:${process.pid}:${Date.now()}`;
  const index = new RedisFusionEvidenceIndex(redis, prefix);
  const observedAt = "2026-09-07T12:00:00.000Z";
  const evidence: FusionEvidence = {
    evidenceId: "evidence-a",
    source: "test",
    sourceType: "execution",
    tenantId: "tenant-a",
    projectId: "project-a",
    objectId: "object-a",
    content: { agentId: "agent-a", workloadId: "workload-a", message: "atomic redis evidence" },
    observedAt,
    indexedAt: observedAt,
    contentHash: "hash-a",
    relevance: 1,
    confidence: 1,
    tags: ["ops", "verified"],
    provenance: { transactionId: "tx-a", attemptId: "attempt-a" },
  };

  try {
    await redis.ping();
    await index.put(evidence);

    assert.equal((await index.search({ tenantId: "tenant-a", projectId: "project-a" })).length, 1);
    assert.equal((await index.search({ tenantId: "tenant-a", transactionId: "tx-a" })).length, 1);
    assert.equal((await index.search({ tenantId: "tenant-a", tags: ["verified"] })).length, 1);
    assert.equal((await index.search({
      tenantId: "tenant-a",
      observedFrom: "2026-09-07T11:59:00.000Z",
      observedTo: "2026-09-07T12:01:00.000Z",
    })).length, 1);

    await index.put(evidence);
    await assert.rejects(
      () => index.put({ ...evidence, contentHash: "hash-conflict" }),
      /fusion_search_evidence_version_conflict/,
    );

    assert.equal(await index.delete("evidence-a", "tenant-a"), true);
    assert.equal((await index.search({ tenantId: "tenant-a" })).length, 0);
    assert.equal(await index.delete("evidence-a", "tenant-a"), false);
  } finally {
    await redis.quit();
  }
});
