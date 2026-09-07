import type { FusionEvidence, FusionSearchContext, FusionSearchQuery, FusionSearchProvider } from "../core/types";
import { assertFusionTenant, clampLimit } from "../core/types";

export type FusionSearchResponse = Readonly<{
  query: FusionSearchQuery;
  evidence: readonly FusionEvidence[];
  providers: readonly string[];
  generatedAt: string;
}>;

export class EvidenceFusionEngine {
  constructor(private readonly providers: readonly FusionSearchProvider[]) {}

  async search(query: FusionSearchQuery, context: FusionSearchContext): Promise<FusionSearchResponse> {
    assertFusionTenant(query, context);

    const requestedSources = query.sources;
    const selected = requestedSources?.length
      ? this.providers.filter((provider) => requestedSources.includes(provider.name))
      : this.providers;

    const results = await Promise.all(selected.map((provider) => provider.search(query, context)));
    const deduped = new Map<string, FusionEvidence>();

    for (const batch of results) {
      for (const evidence of batch) {
        if (evidence.tenantId !== context.tenantId) {
          throw new Error("fusion_search_cross_tenant_evidence");
        }

        const existing = deduped.get(evidence.evidenceId);
        if (!existing || thisrank(evidence) > thisrank(existing)) deduped.set(evidence.evidenceId, evidence);
      }
    }

    const evidence = [...deduped.values()]
      .sort((a, b) => thisrank(b) - thisrank(a))
      .slice(0, clampLimit(query.limit));

    return {
      query,
      evidence,
      providers: selected.map((provider) => provider.name),
      generatedAt: new Date().toISOString(),
    };
  }
}

function thisrank(evidence: FusionEvidence): number {
  return Math.max(0, Math.min(1, evidence.relevance)) * Math.max(0, Math.min(1, evidence.confidence));
}
