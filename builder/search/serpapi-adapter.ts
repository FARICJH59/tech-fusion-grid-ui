import { createHash } from "node:crypto";
import type { WebSearchRequest, WebSearchResult } from "./types";

/**
 * Provider adapter boundary. The API key is deliberately resolved from the
 * process environment and never accepted as an ExecutionUnit parameter.
 * A production deployment should inject it through a secret manager.
 */
export async function searchWithSerpApi(
  request: WebSearchRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<WebSearchResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY is not configured");

  const params = new URLSearchParams({
    q: request.query,
    engine: request.engine ?? "google",
    api_key: apiKey,
  });
  if (request.location) params.set("location", request.location);

  const response = await fetchImpl(`https://serpapi.com/search.json?${params}`);
  if (!response.ok) {
    throw new Error(`SerpApi request failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const provenance_hash = createHash("sha256")
    .update(JSON.stringify({
      provider: "serpapi",
      tenant_id: request.tenant_id,
      project_id: request.project_id,
      query: request.query,
      location: request.location,
      engine: request.engine ?? "google",
      data,
    }))
    .digest("hex");

  return {
    provider: "serpapi",
    query: request.query,
    location: request.location,
    engine: request.engine ?? "google",
    data,
    provenance_hash,
  };
}
