import assert from "node:assert/strict";
import test from "node:test";
import { buildEvidenceBundle, deduplicateEvidence, detectContradictions } from "../builder/search/evidence";
import { runFusionSearch } from "../builder/search/fusion-search";
import type { SearchProvider, WebSearchRequest } from "../builder/search/types";

test("FusionSearch normalizes, deduplicates, and scores evidence", () => {
  const request: WebSearchRequest = {
    tenant_id: "tenant-1",
    project_id: "project-1",
    query: "grid storage",
    limit: 10,
  };
  const result = {
    provider: "serpapi",
    query: request.query,
    engine: "google",
    data: {
      organic_results: [
        { title: "A", link: "https://example.com/a", snippet: "Storage is 120 USD" },
        { title: "A duplicate", link: "https://example.com/a", snippet: "Storage is 120 USD" },
        { title: "B", link: "https://example.org/b", snippet: "Storage is 130 USD" },
      ],
    },
    provenance_hash: "p1",
  };

  const bundle = buildEvidenceBundle(request, [result], "2026-08-16T00:00:00.000Z");
  assert.equal(bundle.evidence.length, 2);
  assert.equal(bundle.contradictions.length, 1);
  assert.ok(bundle.confidence_score >= 0 && bundle.confidence_score <= 1);
  assert.ok(bundle.provenance_hash.length > 0);
});

test("FusionSearch preserves the best duplicate evidence", () => {
  const evidence = [
    { id: "1", provider: "a", source_type: "web", title: "same", url: "https://example.com", acquired_at: "now", relevance_score: 0.4, freshness_score: 0.4, source_quality_score: 0.4, confidence_score: 0.4, provenance_hash: "a" },
    { id: "2", provider: "b", source_type: "web", title: "same", url: "https://example.com", acquired_at: "now", relevance_score: 0.9, freshness_score: 0.9, source_quality_score: 0.9, confidence_score: 0.9, provenance_hash: "b" },
  ];
  const deduped = deduplicateEvidence(evidence);
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0].id, "2");
});

test("FusionSearch contradiction detection is explicit rather than silently choosing a value", () => {
  const evidence = [
    { id: "1", provider: "a", source_type: "web", title: "a", acquired_at: "now", snippet: "The value is 120 USD", relevance_score: 1, freshness_score: 1, source_quality_score: 1, confidence_score: 1, provenance_hash: "a" },
    { id: "2", provider: "b", source_type: "web", title: "b", acquired_at: "now", snippet: "The value is 130 USD", relevance_score: 1, freshness_score: 1, source_quality_score: 1, confidence_score: 1, provenance_hash: "b" },
  ];
  const contradictions = detectContradictions(evidence);
  assert.equal(contradictions.length, 1);
  assert.deepEqual(contradictions[0].values, ["120 USD", "130 USD"]);
});

test("FusionSearch never executes or governs a search result", async () => {
  const request: WebSearchRequest = { tenant_id: "t", project_id: "p", query: "test" };
  let called = 0;
  const provider: SearchProvider = {
    async search() {
      called += 1;
      return {
        provider: "test",
        query: request.query,
        engine: "test",
        data: { organic_results: [{ title: "Test", link: "https://example.com", snippet: "test" }] },
        provenance_hash: "p",
      };
    },
  };
  const bundle = await runFusionSearch(request, [provider]);
  assert.equal(called, 1);
  assert.equal(bundle.evidence[0].title, "Test");
});
