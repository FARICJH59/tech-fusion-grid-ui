import { createHash } from "node:crypto";
import type { WebSearchRequest, WebSearchResult } from "./types";

/**
 * SerpAPI is an acquisition adapter only. It does not rank truth, make
 * decisions, plan execution, or bypass the existing governance boundary.
 */
export async function searchWithSerpApi(
  request: WebSearchRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<WebSearchResult> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY is not configured");

  const engine = request.engine ?? "google";
  const params = new URLSearchParams({
    q: request.query,
    engine,
    api_key: apiKey,
  });
  if (request.location) params.set("location", request.location);

  const response = await fetchImpl(`https://serpapi.com/search.json?${params}`);
  if (!response.ok) throw new Error(`SerpApi request failed: HTTP ${response.status}`);

  const data = await response.json();
  const provenance_hash = createHash("sha256")
    .update(JSON.stringify({ provider: "serpapi", request, data }))
    .digest("hex");

  return {
    provider: "serpapi",
    query: request.query,
    location: request.location,
    engine,
    data,
    provenance_hash,
  };
}

export const serpApiProvider = (fetchImpl?: typeof fetch) => ({
  search: (request: WebSearchRequest) => searchWithSerpApi(request, fetchImpl),
});
