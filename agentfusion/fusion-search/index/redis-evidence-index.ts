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
    this.assertEvidence(evidence);
    const key = this.key(evidence.tenantId, evidence.evidenceId);
    const existing = await this.redis.get(key);
    if (existing) {
      const prior = JSON.parse(existing) as FusionEvidence;
      if (prior.tenantId !== evidence.tenantId) throw new Error("fusion_search_cross_tenant_evidence");
      if (prior.contentHash !== evidence.contentHash) throw new Error("fusion_search_evidence_version_conflict");
      return;
    }

    const indexKeys = this.indexKeys(evidence);
    const multi = this.redis.multi();
    multi.set(key, JSON.stringify(evidence));
    for (const indexKey of indexKeys) multi.sadd(indexKey, evidence.evidenceId);
    multi.zadd(this.observedKey(evidence.tenantId), Date.parse(evidence.observedAt), evidence.evidenceId);
    multi.zadd(this.indexedKey(evidence.tenantId), Date.parse(evidence.indexedAt), evidence.evidenceId);
    multi.sadd(this.membershipKey(evidence.tenantId, evidence.evidenceId), ...indexKeys);
    await multi.exec();
  }

  async putMany(evidence: readonly FusionEvidence[]): Promise<void> {
    const ids = new Set<string>();
    for (const item of evidence) {
      if (ids.has(item.evidenceId)) throw new Error("fusion_search_duplicate_evidence_id");
      ids.add(item.evidenceId);
      this.assertEvidence(item);
    }
    for (const item of evidence) await this.put(item);
  }

  async search(filter: FusionEvidenceIndexFilter, query = ""): Promise<readonly FusionEvidence[]> {
    assertValidEvidenceIndexFilter(filter);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const candidateIds = await this.candidateIds(filter);
    if (!candidateIds.length) return [];

    const records = await Promise.all(candidateIds.map((id) => this.redis.get(this.key(filter.tenantId, id))));
    const matches = records
      .filter((value): value is string => value !== null)
      .map((value) => JSON.parse(value) as FusionEvidence)
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

    const membership = await this.redis.smembers(this.membershipKey(tenantId, evidenceId));
    const multi = this.redis.multi();
    multi.del(key);
    for (const indexKey of membership) multi.srem(indexKey, evidenceId);
    multi.srem(this.tenantKey(tenantId), evidenceId);
    multi.zrem(this.observedKey(tenantId), evidenceId);
    multi.zrem(this.indexedKey(tenantId), evidenceId);
    multi.del(this.membershipKey(tenantId, evidenceId));
    const result = await multi.exec();
    const first = result?.[0]?.[1];
    return first === 1;
  }

  private async candidateIds(filter: FusionEvidenceIndexFilter): Promise<string[]> {
    const sets: string[] = [this.tenantKey(filter.tenantId)];
    if (filter.projectId) sets.push(this.fieldKey("project", filter.tenantId, filter.projectId));
    if (filter.agentId) sets.push(this.fieldKey("agent", filter.tenantId, filter.agentId));
    if (filter.workloadId) sets.push(this.fieldKey("workload", filter.tenantId, filter.workloadId));
    if (filter.transactionId) sets.push(this.fieldKey("transaction", filter.tenantId, filter.transactionId));
    if (filter.attemptId) sets.push(this.fieldKey("attempt", filter.tenantId, filter.attemptId));
    if (filter.source) sets.push(this.fieldKey("source", filter.tenantId, filter.source));
    if (filter.sourceType) sets.push(this.fieldKey("sourceType", filter.tenantId, filter.sourceType));
    for (const tag of filter.tags ?? []) sets.push(this.fieldKey("tag", filter.tenantId, tag));

    let ids: string[];
    if (sets.length === 1) ids = await this.redis.smembers(sets[0]);
    else ids = await this.redis.sinter(...sets);

    const temporalIds = await this.temporalCandidates(filter);
    if (temporalIds === null) return ids;
    if (!ids.length || !temporalIds.length) return [];
    const allowed = new Set(temporalIds);
    return ids.filter((id) => allowed.has(id));
  }

  private async temporalCandidates(filter: FusionEvidenceIndexFilter): Promise<string[] | null> {
    const observed = filter.observedFrom || filter.observedTo;
    const indexed = filter.indexedFrom || filter.indexedTo;
    if (!observed && !indexed) return null;

    const observedIds = observed
      ? await this.redis.zrangebyscore(this.observedKey(filter.tenantId), this.score(filter.observedFrom), this.score(filter.observedTo))
      : null;
    const indexedIds = indexed
      ? await this.redis.zrangebyscore(this.indexedKey(filter.tenantId), this.score(filter.indexedFrom), this.score(filter.indexedTo))
      : null;
    if (observedIds && indexedIds) {
      const allowed = new Set(indexedIds);
      return observedIds.filter((id) => allowed.has(id));
    }
    return observedIds ?? indexedIds ?? [];
  }

  private score(value: string | undefined): number | string {
    return value === undefined ? "-inf" : Date.parse(value);
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

  private assertEvidence(evidence: FusionEvidence): void {
    if (!evidence.tenantId) throw new Error("fusion_search_tenant_required");
    if (!evidence.evidenceId) throw new Error("fusion_search_evidence_id_required");
    if (Number.isNaN(Date.parse(evidence.observedAt)) || Number.isNaN(Date.parse(evidence.indexedAt))) {
      throw new Error("fusion_search_invalid_evidence_date");
    }
  }

  private contentEquals(evidence: FusionEvidence, key: string, expected: string): boolean {
    const content = evidence.content as Record<string, unknown> | null;
    return content?.[key] === expected;
  }

  private indexKeys(evidence: FusionEvidence): string[] {
    const keys = [
      this.tenantKey(evidence.tenantId),
      this.fieldKey("source", evidence.tenantId, evidence.source),
      this.fieldKey("sourceType", evidence.tenantId, evidence.sourceType),
    ];
    if (evidence.projectId) keys.push(this.fieldKey("project", evidence.tenantId, evidence.projectId));
    const content = evidence.content as Record<string, unknown> | null;
    for (const [kind, value] of [["agent", content?.agentId], ["workload", content?.workloadId]] as const) {
      if (typeof value === "string" && value) keys.push(this.fieldKey(kind, evidence.tenantId, value));
    }
    if (evidence.provenance.transactionId) keys.push(this.fieldKey("transaction", evidence.tenantId, evidence.provenance.transactionId));
    if (evidence.provenance.attemptId) keys.push(this.fieldKey("attempt", evidence.tenantId, evidence.provenance.attemptId));
    for (const tag of evidence.tags ?? []) keys.push(this.fieldKey("tag", evidence.tenantId, tag));
    return [...new Set(keys)];
  }

  private fieldKey(kind: string, tenantId: string, value: string): string {
    return `${this.prefix}:${kind}:${encodeURIComponent(tenantId)}:${encodeURIComponent(value)}`;
  }

  private tenantKey(tenantId: string): string {
    return this.fieldKey("tenant", tenantId, "_all");
  }

  private observedKey(tenantId: string): string {
    return `${this.prefix}:observed:${encodeURIComponent(tenantId)}`;
  }

  private indexedKey(tenantId: string): string {
    return `${this.prefix}:indexed:${encodeURIComponent(tenantId)}`;
  }

  private membershipKey(tenantId: string, evidenceId: string): string {
    return `${this.prefix}:membership:${encodeURIComponent(tenantId)}:${encodeURIComponent(evidenceId)}`;
  }

  private key(tenantId: string, evidenceId: string): string {
    return `${this.prefix}:record:${encodeURIComponent(tenantId)}:${encodeURIComponent(evidenceId)}`;
  }
}
