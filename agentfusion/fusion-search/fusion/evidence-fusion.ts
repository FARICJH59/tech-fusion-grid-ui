import type { FusionEvidence, FusionSearchContext, FusionSearchQuery, FusionSearchProvider } from "../core/types";
import { assertFusionTenant, clampLimit } from "../core/types";
import type { FusionEvidenceIndex } from "../index/evidence-index";

export type FusionSearchResponse = Readonly<{
  query: FusionSearchQuery;
  evidence: readonly FusionEvidence[];
  providers: readonly string[];
  generatedAt: string;
}>;

export class EvidenceFusionEngine {
  constructor(
    private readonly providers: readonly FusionSearchProvider[],
    private readonly index?: FusionEvidenceIndex,
  ) {}

  async search(query: FusionSearchQuery, context: FusionSearchContext): Promise<FusionSearchResponse> {
    assertFusionTenant(query, context);

    const requestedSources = query.sources;
    const selected = requestedSources?.length
      ? this.providers.filter((provider) => requestedSources.includes(provider.name))
      : this.providers;

    const results = await Promise.all(selected.map((provider) => provider.search(query, context)));
    const deduped = new Map<string, FusionEvidence>();

    if (this.index) {
      const indexed = await this.index.search({
        tenantId: context.tenantId,
        projectId: query.projectId,
        agentId: query.agentId,
        workloadId: query.workloadId,
        transactionId: query.transactionId,
        attemptId: query.attemptId,
        tags: query.tags,
        observedFrom: query.timeRange?.from,
        observedTo: query.timeRange?.to,
        limit: clampLimit(query.limit),
      }, query.query);
      for (const evidence of indexed) {
        if (evidence.tenantId !== context.tenantId) throw new Error("fusion_search_cross_tenant_evidence");
        deduped.set(evidence.evidenceId, evidence);
      }
    }

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
      .sort((a, b) => {
        const delta = thisrank(b) - thisrank(a);
        return delta !== 0 ? delta : a.evidenceId.localeCompare(b.evidenceId);
      })
      .slice(0, clampLimit(query.limit));

    if (this.index && evidence.length) await this.index.putMany(evidence);

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
