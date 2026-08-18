import assert from "node:assert/strict";
import test from "node:test";
import { HttpFusionSearchProvider } from "../agentfusion/search/fusion-search";

test("Fusion Search performs a live HTTP provider request", async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async (_input, init) => {
    called = true;
    const body = JSON.parse(String(init?.body)) as { query: string; limit: number };
    assert.equal(body.query, "defense edge AI");
    assert.equal(body.limit, 5);
    return new Response(JSON.stringify({ results: [{ title: "Doc", url: "https://example.test/doc", snippet: "live result" }] }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;

  try {
    const provider = new HttpFusionSearchProvider({ endpoint: "https://search-provider.test", timeoutMs: 1000 });
    const results = await provider.search({ query: "defense edge AI", limit: 5 });
    assert.equal(called, true);
    assert.equal(results[0]?.url, "https://example.test/doc");
    assert.equal(results[0]?.source, "live-provider");
    assert.ok(results[0]?.retrievedAt);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
