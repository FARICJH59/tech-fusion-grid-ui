import { buildEvidenceBundle } from "./evidence";
import type { EvidenceBundle, SearchProvider, WebSearchRequest } from "./types";

/**
 * Search orchestration is intentionally limited to acquisition + evidence
 * fusion. Planning, governance, PASOR, and execution remain downstream.
 */
export async function runFusionSearch(
  request: WebSearchRequest,
  providers: SearchProvider[],
): Promise<EvidenceBundle> {
  if (!request.tenant_id) throw new Error("tenant_id is required");
  if (!request.project_id) throw new Error("project_id is required");
  if (!request.query.trim()) throw new Error("query is required");
  if (providers.length === 0) throw new Error("at least one search provider is required");

  const results = await Promise.all(providers.map((provider) => provider.search(request)));
  return buildEvidenceBundle(request, results);
}
