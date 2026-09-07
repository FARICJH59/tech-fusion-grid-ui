import type Redis from "ioredis";
import type { FusionEvidence } from "../core/types";
import {
  assertValidEvidenceIndexFilter,
  type FusionEvidenceIndex,
  type FusionEvidenceIndexFilter,
} from "./evidence-index";

/** Durable metadata index. Secrets and authority objects are never persisted. */
export class RedisFusionEvidenceIndex implements FusionEvidenceIndex {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = "fusion:evidence:v1",
  ) {}

  async put(evidence: FusionEvidence): Promise<void> {
    if (!evidence.tenantId) throw new Error("fusion_search_tenant_required");
    const key = this.key(evidence.tenantId, evidence.evidenceId);
    const existing = await this.redis.get(key);
    if (existing) {
      const prior = JSON.parse(existing) as FusionEvidence;
      if (prior.tenantId !== evidence.tenantId) throw new Error("fusion_search_cross_tenant_evidence");
      if (prior.contentHash !== evidence.contentHash) throw new Error("fusion_search_evidence_version_conflict");
    }
    await this.redis.set(key, JSON.stringify(evidence));
    await this.redis.sadd(this.tenantKey(evidence.tenantId), evidence.evidenceId);
  }

  async putMany(evidence: readonly FusionEvidence[]): Promise<void> {
    const ids = new Set<string>();
    for (const item of evidence) {
      if (ids.has(item.evidenceId)) throw new Error("fusion_search_duplicate_evidence_id");
      ids.add(item.evidenceId);
    }
    for (const item of evidence) await this.put(item);
  }

  async search(filter: FusionEvidenceIndexFilter, query = ""): Promise<readonly FusionEvidence[]> {
    assertValidEvidenceIndexFilter(filter);
    const ids = await this.redis.smembers(this.tenantKey(filter.tenantId));
    const records = await Promise.all(ids.map((id) => this.redis.get(this.key(filter.tenantId, id))));
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const matches = records.filter((value): value is string => value !== null).map((value) => JSON.parse(value) as FusionEvidence)
      .filter((evidence) => this.matches(evidence, filter, terms));

    matches.sort((left, right) => {
      const scoreDelta = right.relevance * right.confidence - left.relevance * left.confidence;
      return scoreDelta !== 0 ? scoreDelta : left.evidenceId.localeCompare(right.evidenceId);
    });
    return matches.slice(0, filter.limit ?? 20);
  }

  async delete(evidenceId: string, tenantId: string): Promise<boolean> {
    if (!tenantId) throw new Error("fusion_search_tenant_required");
    const key = this.key(tenantId, evidenceId);
    const existing = await this.redis.get(key);
    if (!existing) return false;
    const evidence = JSON.parse(existing) as FusionEvidence;
    if (evidence.tenantId !== tenantId) throw new Error("fusion_search_cross_tenant_evidence");
    const removed = await this.redis.del(key);
    await this.redis.srem(this.tenantKey(tenantId), evidenceId);
    return removed === 1;
  }

  private matches(evidence: FusionEvidence, filter: FusionEvidenceIndexFilter, terms: readonly string[]): boolean {
    if (evidence.tenantId !== filter.tenantId) return false;
    if (filter.projectId && evidence.projectId !== filter.projectId) return false;
    if (filter.agentId && !this.contentEquals(evidence, "agentId", filter.agentId)) return false;
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
  }

  private contentEquals(evidence: FusionEvidence, key: string, expected: string): boolean {
    const content = evidence.content as Record<string, unknown> | null;
    return content?.[key] === expected;
  }

  private tenantKey(tenantId: string): string {
    return `${this.prefix}:tenant:${encodeURIComponent(tenantId)}`;
  }

  private key(tenantId: string, evidenceId: string): string {
    return `${this.prefix}:record:${encodeURIComponent(tenantId)}:${encodeURIComponent(evidenceId)}`;
  }
}
