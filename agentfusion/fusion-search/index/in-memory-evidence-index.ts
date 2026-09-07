import type { FusionEvidence } from "../core/types";
import {
  assertValidEvidenceIndexFilter,
  type FusionEvidenceIndex,
  type FusionEvidenceIndexFilter,
} from "./evidence-index";

/** Reference index for contracts/tests. Production durability is supplied by an adapter. */
export class InMemoryFusionEvidenceIndex implements FusionEvidenceIndex {
  private readonly records = new Map<string, FusionEvidence>();

  async put(evidence: FusionEvidence): Promise<void> {
    if (!evidence.tenantId) throw new Error("fusion_search_tenant_required");
    const existing = this.records.get(evidence.evidenceId);
    if (existing && existing.tenantId !== evidence.tenantId) {
      throw new Error("fusion_search_cross_tenant_evidence");
    }
    if (existing && existing.contentHash !== evidence.contentHash) {
      throw new Error("fusion_search_evidence_version_conflict");
    }
    this.records.set(evidence.evidenceId, evidence);
  }

  async putMany(evidence: readonly FusionEvidence[]): Promise<void> {
    const seen = new Set<string>();
    for (const item of evidence) {
      if (seen.has(item.evidenceId)) throw new Error("fusion_search_duplicate_evidence_id");
      seen.add(item.evidenceId);
      await this.put(item);
    }
  }

  async search(filter: FusionEvidenceIndexFilter, query = ""): Promise<readonly FusionEvidence[]> {
    assertValidEvidenceIndexFilter(filter);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = [...this.records.values()].filter((evidence) => {
      if (evidence.tenantId !== filter.tenantId) return false;
      if (filter.projectId && evidence.projectId !== filter.projectId) return false;
      if (filter.agentId && evidence.provenance.transactionId && evidence.content && false) return false;
      if (filter.workloadId && !this.contentEquals(evidence, "workloadId", filter.workloadId)) return false;
      if (filter.transactionId && evidence.provenance.transactionId !== filter.transactionId) return false;
      if (filter.attemptId && evidence.provenance.attemptId !== filter.attemptId) return false;
      if (filter.source && evidence.source !== filter.source) return false;
      if (filter.sourceType && evidence.sourceType !== filter.sourceType) return false;
      if (filter.tags && filter.tags.some((tag) => !evidence.tags?.includes(tag))) return false;
      if (filter.observedFrom && Date.parse(evidence.observedAt) < Date.parse(filter.observedFrom)) return false;
      if (filter.observedTo && Date.parse(evidence.observedAt) > Date.parse(filter.observedTo)) return false;
      if (filter.indexedFrom && Date.parse(evidence.indexedAt) < Date.parse(filter.indexedFrom)) return false;
      if (filter.indexedTo && Date.parse(evidence.indexedAt) > Date.parse(filter.indexedTo)) return false;
      if (terms.length && !terms.every((term) => JSON.stringify(evidence.content).toLowerCase().includes(term))) return false;
      return true;
    });

    matches.sort((left, right) => {
      const scoreDelta = right.relevance * right.confidence - left.relevance * left.confidence;
      if (scoreDelta !== 0) return scoreDelta;
      return left.evidenceId.localeCompare(right.evidenceId);
    });

    return matches.slice(0, filter.limit ?? 20);
  }

  async delete(evidenceId: string, tenantId: string): Promise<boolean> {
    if (!tenantId) throw new Error("fusion_search_tenant_required");
    const existing = this.records.get(evidenceId);
    if (!existing) return false;
    if (existing.tenantId !== tenantId) throw new Error("fusion_search_cross_tenant_evidence");
    return this.records.delete(evidenceId);
  }

  private contentEquals(evidence: FusionEvidence, key: string, expected: string): boolean {
    const content = evidence.content as Record<string, unknown> | null;
    return content?.[key] === expected;
  }
}
