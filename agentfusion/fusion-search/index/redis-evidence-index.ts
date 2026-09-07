import type Redis from "ioredis";
import type { FusionEvidence } from "../core/types";
import {
  assertValidEvidenceIndexFilter,
  type FusionEvidenceIndex,
  type FusionEvidenceIndexFilter,
} from "./evidence-index";

const PUT_EVIDENCE_SCRIPT = `
local record = KEYS[1]
local observed = KEYS[2]
local indexed = KEYS[3]
local membership = KEYS[4]
local evidence_id = ARGV[1]
local payload = ARGV[2]
local content_hash = ARGV[3]
local observed_at = ARGV[4]
local indexed_at = ARGV[5]

local existing = redis.call('GET', record)
if existing then
  local prior = cjson.decode(existing)
  if prior.tenantId ~= cjson.decode(payload).tenantId then
    return 'TENANT_MISMATCH'
  end
  if prior.contentHash ~= content_hash then
    return 'VERSION_CONFLICT'
  end
  return 'UNCHANGED'
end

redis.call('SET', record, payload)
redis.call('ZADD', observed, observed_at, evidence_id)
redis.call('ZADD', indexed, indexed_at, evidence_id)
for i = 5, #KEYS do
  redis.call('SADD', KEYS[i], evidence_id)
  redis.call('SADD', membership, KEYS[i])
end
return 'CREATED'
`;

const DELETE_EVIDENCE_SCRIPT = `
local record = KEYS[1]
local tenant = KEYS[2]
local observed = KEYS[3]
local indexed = KEYS[4]
local membership = KEYS[5]
local evidence_id = ARGV[1]
local tenant_id = ARGV[2]

local existing = redis.call('GET', record)
if not existing then
  return 'MISSING'
end
local evidence = cjson.decode(existing)
if evidence.tenantId ~= tenant_id then
  return 'TENANT_MISMATCH'
end

local memberships = redis.call('SMEMBERS', membership)
redis.call('DEL', record)
redis.call('SREM', tenant, evidence_id)
redis.call('ZREM', observed, evidence_id)
redis.call('ZREM', indexed, evidence_id)
for i = 1, #memberships do
  redis.call('SREM', memberships[i], evidence_id)
end
redis.call('DEL', membership)
return 'DELETED'
`;

/** Durable metadata index. Secrets and authority objects are never persisted. */
export class RedisFusionEvidenceIndex implements FusionEvidenceIndex {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = "fusion:evidence:v1",
  ) {}

  async put(evidence: FusionEvidence): Promise<void> {
    this.assertEvidence(evidence);
    const key = this.key(evidence.tenantId, evidence.evidenceId);
    const indexKeys = this.indexKeys(evidence);
    const result = await this.redis.eval(
      PUT_EVIDENCE_SCRIPT,
      4 + indexKeys.length,
      key,
      this.observedKey(evidence.tenantId),
      this.indexedKey(evidence.tenantId),
      this.membershipKey(evidence.tenantId, evidence.evidenceId),
      ...indexKeys,
      evidence.evidenceId,
      JSON.stringify(evidence),
      evidence.contentHash,
      String(Date.parse(evidence.observedAt)),
      String(Date.parse(evidence.indexedAt)),
    );

    if (result === "TENANT_MISMATCH") throw new Error("fusion_search_cross_tenant_evidence");
    if (result === "VERSION_CONFLICT") throw new Error("fusion_search_evidence_version_conflict");
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
    const result = await this.redis.eval(
      DELETE_EVIDENCE_SCRIPT,
      5,
      this.key(tenantId, evidenceId),
      this.tenantKey(tenantId),
      this.observedKey(tenantId),
      this.indexedKey(tenantId),
      this.membershipKey(tenantId, evidenceId),
      evidenceId,
      tenantId,
    );

    if (result === "TENANT_MISMATCH") throw new Error("fusion_search_cross_tenant_evidence");
    return result === "DELETED";
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
