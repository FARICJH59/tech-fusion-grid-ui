import assert from "node:assert/strict";
import test from "node:test";
import { searchWithSerpApi } from "./serpapi-adapter";

test("SerpApi adapter never takes credentials from the request", async () => {
  process.env.SERPAPI_KEY = "test-only-secret";
  let requestedUrl = "";

  const result = await searchWithSerpApi(
    {
      tenant_id: "tenant_test_001",
      project_id: "project_test_001",
      query: "Coffee",
      location: "Austin, Texas, United States",
      engine: "google",
    },
    async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ organic_results: [] }), { status: 200 });
    },
  );

  assert.equal(result.provider, "serpapi");
  assert.ok(result.provenance_hash.length === 64);
  assert.match(requestedUrl, /api_key=test-only-secret/);
  assert.doesNotMatch(JSON.stringify(result), /test-only-secret/);
});
