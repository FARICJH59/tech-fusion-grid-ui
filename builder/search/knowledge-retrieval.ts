import type { MemoryRecord } from "../../packages/agent-sdk/src/memory";
import { AgentMemoryRuntime } from "../../agentfusion/memory/memory-runtime";
import type { KnowledgeMemoryValue } from "./knowledge-memory";

export type KnowledgeRetrievalRequest = {
  tenant_id: string;
  query: string;
  top_k?: number;
};

export type KnowledgeRetrievalItem = {
  record: MemoryRecord;
  knowledge: KnowledgeMemoryValue;
  score: number;
  relevance_score: number;
  freshness_score: number;
  provenance_score: number;
};

export type KnowledgeRetrievalResult = {
  tenant_id: string;
  query: string;
  items: KnowledgeRetrievalItem[];
};

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1));
}

function relevance(query: string, knowledge: KnowledgeMemoryValue): number {
  const queryTokens = tokens(query);
  if (queryTokens.size === 0) return 0;
  const haystack = tokens([knowledge.title, knowledge.snippet ?? "", knowledge.content ?? ""].join(" "));
  let matches = 0;
  for (const token of queryTokens) if (haystack.has(token)) matches += 1;
  return matches / queryTokens.size;
}

function freshness(updatedAt: string): number {
  const ageMs = Math.max(0, Date.now() - Date.parse(updatedAt));
  if (!Number.isFinite(ageMs)) return 0;
  const ageDays = ageMs / 86_400_000;
  return Math.exp(-ageDays / 30);
}

function provenanceCompleteness(knowledge: KnowledgeMemoryValue): number {
  const p = knowledge.provenance;
  const fields = [
    p.source,
    p.source_class,
    p.acquisition_method,
    p.acquired_at,
    p.license_status,
    p.content_hash,
    p.evidence_id,
    p.evidence_provenance_hash,
  ];
  return fields.filter(Boolean).length / fields.length;
}

/**
 * Retrieves only tenant-scoped long-term knowledge from the existing memory
 * boundary. Ranking is deterministic and advisory; authorization remains
 * downstream in the policy/decision layer.
 */
export async function retrieveKnowledge(
  request: KnowledgeRetrievalRequest,
  memory: AgentMemoryRuntime = new AgentMemoryRuntime(),
): Promise<KnowledgeRetrievalResult> {
  if (!request.tenant_id) throw new Error("tenant_id is required");
  if (!request.query.trim()) throw new Error("query is required");

  const topK = Math.max(1, Math.min(request.top_k ?? 5, 50));
  const records = await memory.longTerm.search({
    tenantId: request.tenant_id,
    tier: "long-term",
  });

  const items = records
    .filter((record) => record.key.startsWith("knowledge:"))
    .flatMap((record) => {
      const knowledge = record.value as Partial<KnowledgeMemoryValue>;
      if (knowledge.kind !== "knowledge-candidate" || !knowledge.title || !knowledge.provenance) return [];
      const relevanceScore = relevance(request.query, knowledge as KnowledgeMemoryValue);
      const freshnessScore = freshness(record.updatedAt);
      const provenanceScore = provenanceCompleteness(knowledge as KnowledgeMemoryValue);
      const confidenceScore = Math.max(0, Math.min(1, Number(knowledge.confidence_score ?? 0)));
      const score =
        relevanceScore * 0.45 +
        confidenceScore * 0.30 +
        freshnessScore * 0.10 +
        provenanceScore * 0.15;
      return [{
        record,
        knowledge: knowledge as KnowledgeMemoryValue,
        score,
        relevance_score: relevanceScore,
        freshness_score: freshnessScore,
        provenance_score: provenanceScore,
      }];
    })
    .filter((item) => item.relevance_score > 0)
    .sort((a, b) => b.score - a.score || Date.parse(b.record.updatedAt) - Date.parse(a.record.updatedAt))
    .slice(0, topK);

  return { tenant_id: request.tenant_id, query: request.query, items };
}
