import type { MemoryProvider, MemoryQuery, MemoryRecord } from "../../../packages/agent-sdk/src/memory";
import {
  assertFusionTenant,
  clampLimit,
  type FusionEvidence,
  type FusionSearchContext,
  type FusionSearchProvider,
  type FusionSearchQuery,
} from "../core/types";

export class AgentFusionMemorySearchProvider implements FusionSearchProvider {
  readonly name = "agentfusion-memory";

  constructor(private readonly memory: MemoryProvider) {}

  async search(query: FusionSearchQuery, context: FusionSearchContext): Promise<readonly FusionEvidence[]> {
    assertFusionTenant(query, context);

    const records = await this.memory.search({
      tenantId: query.tenantId,
      agentId: query.agentId,
      tags: query.tags ? [...query.tags] : undefined,
    });

    return records
      .filter((record) => this.matchesScope(record, query, context))
      .map((record) => this.toEvidence(record, query))
      .sort((a, b) => b.relevance - a.relevance || Date.parse(b.observedAt) - Date.parse(a.observedAt))
      .slice(0, clampLimit(query.limit));
  }

  private matchesScope(record: MemoryRecord, query: FusionSearchQuery, context: FusionSearchContext): boolean {
    if (record.tenantId !== context.tenantId) return false;
    if (query.projectId && this.readString(record.value, "projectId") !== query.projectId) return false;
    if (query.workloadId && this.readString(record.value, "workloadId") !== query.workloadId) return false;
    if (query.transactionId && this.readString(record.value, "transactionId") !== query.transactionId) return false;
    if (query.attemptId && this.readString(record.value, "attemptId") !== query.attemptId) return false;

    const { from, to } = query.timeRange ?? {};
    const observed = Date.parse(record.updatedAt);
    if (from && observed < Date.parse(from)) return false;
    if (to && observed > Date.parse(to)) return false;
    return this.score(record.value, query.query) > 0;
  }

  private toEvidence(record: MemoryRecord, query: FusionSearchQuery): FusionEvidence {
    const observedAt = record.updatedAt;
    const serialized = JSON.stringify(record.value);
    return {
      evidenceId: `memory:${record.tenantId}:${record.agentId ?? "shared"}:${record.key}`,
      source: this.name,
      sourceType: "agent-memory",
      tenantId: record.tenantId,
      objectId: record.key,
      content: record.value,
      observedAt,
      indexedAt: new Date().toISOString(),
      contentHash: this.fnv1a(serialized),
      relevance: this.score(record.value, query.query),
      confidence: 1,
      tags: record.tags,
      provenance: {},
    };
  }

  private score(value: unknown, query: string): number {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return 1;
    const text = JSON.stringify(value).toLowerCase();
    const hits = terms.filter((term) => text.includes(term)).length;
    return hits / terms.length;
  }

  private readString(value: unknown, key: string): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === "string" ? candidate : undefined;
  }

  private fnv1a(value: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
}
