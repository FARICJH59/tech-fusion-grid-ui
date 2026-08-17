import assert from "node:assert/strict";
import test from "node:test";
import { retrieveKnowledge } from "../builder/search/intelligence";
import type { KnowledgeCandidate } from "../builder/search/knowledge";

function candidate(
  id: string,
  title: string,
  snippet: string,
  confidence_score: number,
  acquired_at = "2026-08-16T00:00:00.000Z",
): KnowledgeCandidate {
  return {
    id,
    tenant_id: "tenant-1",
    project_id: "project-1",
    title,
    snippet,
    confidence_score,
    provenance: {
      source: `https://example.com/${id}`,
      source_class: "web",
      acquisition_method: "serpapi",
      acquired_at,
      license_status: "known-permitted",
      content_hash: `content-${id}`,
      evidence_id: `evidence-${id}`,
      evidence_provenance_hash: `provenance-${id}`,
    },
  };
}

test("knowledge intelligence ranks relevant governed knowledge", () => {
  const result = retrieveKnowledge(
    { tenant_id: "tenant-1", project_id: "project-1", query: "grid storage", limit: 2 },
    [
      candidate("strong", "Grid Storage Systems", "Battery grid storage deployment", 0.9),
      candidate("weak", "Grid Operations", "Operations overview", 0.8),
      candidate("other", "Solar Forecasting", "Forecasting solar output", 0.99),
    ],
    Date.parse("2026-08-17T00:00:00.000Z"),
  );

  assert.equal(result.matches.length, 2);
  assert.equal(result.matches[0].candidate.id, "strong");
  assert.ok(result.matches[0].final_score > result.matches[1].final_score);
});

test("knowledge intelligence enforces tenant and project isolation", () => {
  const foreignTenant = { ...candidate("foreign-tenant", "Grid Storage", "grid storage", 1), tenant_id: "tenant-2" };
  const foreignProject = { ...candidate("foreign-project", "Grid Storage", "grid storage", 1), project_id: "project-2" };
  const result = retrieveKnowledge(
    { tenant_id: "tenant-1", project_id: "project-1", query: "grid storage" },
    [candidate("local", "Grid Storage", "grid storage", 0.8), foreignTenant, foreignProject],
  );

  assert.deepEqual(result.matches.map((match) => match.candidate.id), ["local"]);
});

test("knowledge intelligence exposes competing factual values instead of choosing silently", () => {
  const result = retrieveKnowledge(
    { tenant_id: "tenant-1", project_id: "project-1", query: "grid storage cost" },
    [
      candidate("a", "Grid storage cost", "Estimated cost is 120 USD", 0.9),
      candidate("b", "Grid storage cost", "Estimated cost is 130 USD", 0.85),
    ],
  );

  assert.equal(result.contradictions.length, 1);
  assert.deepEqual(new Set(result.contradictions[0].map((item) => item.id)), new Set(["a", "b"]));
});

test("knowledge intelligence rejects incomplete query identity", () => {
  assert.throws(
    () => retrieveKnowledge({ tenant_id: "", project_id: "project-1", query: "grid" }, []),
    /tenant_id is required/,
  );
  assert.throws(
    () => retrieveKnowledge({ tenant_id: "tenant-1", project_id: "", query: "grid" }, []),
    /project_id is required/,
  );
  assert.throws(
    () => retrieveKnowledge({ tenant_id: "tenant-1", project_id: "project-1", query: "" }, []),
    /query is required/,
  );
});
