import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { acquireKnowledgeCandidates } from "../builder/search/knowledge";
import { FileKnowledgeRepository, knowledgeRecordId } from "../builder/search/substrate";
import type { EvidenceBundle } from "../builder/search/types";

const bundle: EvidenceBundle = {
  query: "grid storage",
  acquired_at: "2026-08-16T00:00:00.000Z",
  evidence: [{
    id: "evidence-1", provider: "serpapi", source_type: "web", title: "Grid Storage",
    url: "https://example.com/storage", snippet: "A storage reference.",
    acquired_at: "2026-08-16T00:00:00.000Z", relevance_score: 0.9,
    freshness_score: 0.8, source_quality_score: 0.7, confidence_score: 0.82,
    provenance_hash: "evidence-provenance",
  }],
  contradictions: [], confidence_score: 0.82, provenance_hash: "bundle-provenance",
};

test("knowledge substrate persists and reloads tenant/project-scoped records", async () => {
  const root = await mkdtemp(`${tmpdir()}/hoare-knowledge-`);
  try {
    const repo = new FileKnowledgeRepository(root);
    const candidate = acquireKnowledgeCandidates(bundle, "tenant-1", "project-1", { license_status: "known-permitted" }).candidates[0];
    const saved = await repo.save(candidate);
    const reloaded = await repo.get(saved.record_id, "tenant-1", "project-1");
    assert.equal(reloaded?.version, 1);
    assert.equal(reloaded?.candidate.tenant_id, "tenant-1");
    assert.equal(reloaded?.candidate.provenance.license_status, "known-permitted");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("knowledge substrate creates immutable versions and preserves history", async () => {
  const root = await mkdtemp(`${tmpdir()}/hoare-knowledge-`);
  try {
    const repo = new FileKnowledgeRepository(root);
    const candidate = acquireKnowledgeCandidates(bundle, "tenant-1", "project-1").candidates[0];
    const first = await repo.save(candidate);
    const second = await repo.save({ ...candidate, snippet: "Updated reference." });
    assert.equal(first.record_id, second.record_id);
    assert.equal(second.version, 2);
    assert.notEqual(first.version_hash, second.version_hash);
    const history = await repo.history(first.record_id, "tenant-1", "project-1");
    assert.deepEqual(history.map((entry) => entry.version), [1, 2]);
    assert.equal(history[0].candidate.snippet, "A storage reference.");
    assert.equal(history[1].candidate.snippet, "Updated reference.");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("tenant/project boundaries prevent cross-scope reads", async () => {
  const root = await mkdtemp(`${tmpdir()}/hoare-knowledge-`);
  try {
    const repo = new FileKnowledgeRepository(root);
    const candidate = acquireKnowledgeCandidates(bundle, "tenant-1", "project-1").candidates[0];
    const saved = await repo.save(candidate);
    assert.equal(await repo.get(saved.record_id, "tenant-2", "project-1"), null);
    assert.equal(await repo.get(saved.record_id, "tenant-1", "project-2"), null);
    assert.equal(knowledgeRecordId(candidate), saved.record_id);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
