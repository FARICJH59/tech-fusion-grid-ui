import assert from "node:assert/strict";
import test from "node:test";
import { acquireKnowledgeCandidates, validateKnowledgeCandidate } from "./knowledge";
import type { EvidenceBundle, SearchEvidence } from "./types";

function evidence(overrides: Partial<SearchEvidence> = {}): SearchEvidence {
  return {
    id: "evidence-1",
    provider: "serpapi",
    source_type: "web",
    title: "Example result",
    url: "https://example.com/article",
    snippet: "Example evidence",
    acquired_at: "2026-08-16T00:00:00.000Z",
    relevance_score: 0.9,
    freshness_score: 0.8,
    source_quality_score: 0.7,
    confidence_score: 0.82,
    provenance_hash: "evidence-provenance",
    ...overrides,
  };
}

function bundle(item: SearchEvidence = evidence()): EvidenceBundle {
  return {
    query: "example query",
    acquired_at: "2026-08-16T00:00:00.000Z",
    evidence: [item],
    contradictions: [],
    confidence_score: 0.82,
    provenance_hash: "bundle-provenance",
  };
}

test("acquires tenant/project-bound knowledge with provenance", () => {
  const result = acquireKnowledgeCandidates(bundle(), "tenant-a", "project-a", {
    license_status: "known-permitted",
    jurisdiction: "US",
    retention_policy: "standard",
  });

  assert.equal(result.candidates.length, 1);
  const candidate = result.candidates[0];
  assert.equal(candidate.tenant_id, "tenant-a");
  assert.equal(candidate.project_id, "project-a");
  assert.equal(candidate.provenance.source_class, "web");
  assert.equal(candidate.provenance.license_status, "known-permitted");
  assert.equal(candidate.provenance.jurisdiction, "US");
  assert.equal(candidate.provenance.evidence_id, "evidence-1");
  assert.match(candidate.provenance.content_hash, /^[a-f0-9]{64}$/);
  assert.match(result.provenance_hash, /^[a-f0-9]{64}$/);
  validateKnowledgeCandidate(candidate);
});

test("preserves non-web source classes instead of collapsing them to api", () => {
  for (const sourceType of ["document", "api", "repository"] as const) {
    const result = acquireKnowledgeCandidates(
      bundle(evidence({ id: `evidence-${sourceType}`, source_type: sourceType })),
      "tenant-a",
      "project-a",
    );

    assert.equal(result.candidates[0].provenance.source_class, sourceType);
  }
});

test("defaults license status to unknown rather than implying permission", () => {
  const result = acquireKnowledgeCandidates(bundle(), "tenant-a", "project-a");
  assert.equal(result.candidates[0].provenance.license_status, "unknown");
});

test("rejects knowledge acquisition without tenant or project scope", () => {
  assert.throws(() => acquireKnowledgeCandidates(bundle(), "", "project-a"), /tenant_id is required/);
  assert.throws(() => acquireKnowledgeCandidates(bundle(), "tenant-a", ""), /project_id is required/);
});

test("validation rejects incomplete provenance", () => {
  const result = acquireKnowledgeCandidates(bundle(), "tenant-a", "project-a");
  const candidate = result.candidates[0];
  const invalid = {
    ...candidate,
    provenance: { ...candidate.provenance, evidence_id: "" },
  };

  assert.throws(() => validateKnowledgeCandidate(invalid), /evidence id is required/);
});
