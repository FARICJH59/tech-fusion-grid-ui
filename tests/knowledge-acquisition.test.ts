import assert from "node:assert/strict";
import test from "node:test";
import { acquireKnowledgeCandidates, validateKnowledgeCandidate } from "../builder/search/knowledge";
import type { EvidenceBundle } from "../builder/search/types";

const bundle: EvidenceBundle = {
  query: "grid storage",
  acquired_at: "2026-08-16T00:00:00.000Z",
  evidence: [
    {
      id: "evidence-1",
      provider: "serpapi",
      source_type: "web",
      title: "Grid Storage",
      url: "https://example.com/storage",
      snippet: "A storage reference.",
      acquired_at: "2026-08-16T00:00:00.000Z",
      relevance_score: 0.9,
      freshness_score: 0.8,
      source_quality_score: 0.7,
      confidence_score: 0.82,
      provenance_hash: "evidence-provenance",
    },
  ],
  contradictions: [],
  confidence_score: 0.82,
  provenance_hash: "bundle-provenance",
};

test("knowledge acquisition preserves tenant/project binding and provenance", () => {
  const result = acquireKnowledgeCandidates(bundle, "tenant-1", "project-1", {
    license_status: "known-permitted",
    jurisdiction: "US",
    retention_policy: "90d",
  });

  assert.equal(result.candidates.length, 1);
  const candidate = result.candidates[0];
  assert.equal(candidate.tenant_id, "tenant-1");
  assert.equal(candidate.project_id, "project-1");
  assert.equal(candidate.provenance.license_status, "known-permitted");
  assert.equal(candidate.provenance.jurisdiction, "US");
  assert.equal(candidate.provenance.retention_policy, "90d");
  assert.equal(candidate.provenance.evidence_id, "evidence-1");
  assert.equal(candidate.provenance.evidence_provenance_hash, "evidence-provenance");
  assert.match(candidate.provenance.content_hash, /^[a-f0-9]{64}$/);
  assert.match(result.provenance_hash, /^[a-f0-9]{64}$/);
  validateKnowledgeCandidate(candidate);
});

test("unknown licensing remains explicit rather than being treated as permitted", () => {
  const result = acquireKnowledgeCandidates(bundle, "tenant-1", "project-1");
  assert.equal(result.candidates[0].provenance.license_status, "unknown");
});

test("knowledge acquisition rejects missing tenant or project identity", () => {
  assert.throws(() => acquireKnowledgeCandidates(bundle, "", "project-1"), /tenant_id is required/);
  assert.throws(() => acquireKnowledgeCandidates(bundle, "tenant-1", ""), /project_id is required/);
});

test("knowledge validation rejects candidates without provenance", () => {
  const result = acquireKnowledgeCandidates(bundle, "tenant-1", "project-1");
  const candidate = result.candidates[0];
  candidate.provenance.content_hash = "";
  assert.throws(() => validateKnowledgeCandidate(candidate), /content hash is required/);
});
