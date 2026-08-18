import assert from "node:assert/strict";
import test from "node:test";
import { HttpFusionSearchSource } from "../lib/fusion-search/http-source";

test("HTTP Fusion Search source performs a real provider request", async () => {
  const originalFetch = globalThis.fetch;
  let requested = false;
  globalThis.fetch = (async (_input, init) => {
    requested = true;
    const payload = JSON.parse(String(init?.body)) as { query: string; limit: number };
    assert.equal(payload.query, "defense supply chain");
    assert.equal(payload.limit, 5);
    return new Response(JSON.stringify({ results: [{ title: "Supply chain", snippet: "live evidence", url: "https://example.test/supply" }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const source = new HttpFusionSearchSource({ name: "test-live", endpoint: "https://provider.test/search" });
    const results = await source.search("defense supply chain", 5);
    assert.equal(requested, true);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.source, "test-live");
    assert.equal(results[0]?.uri, "https://example.test/supply");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
