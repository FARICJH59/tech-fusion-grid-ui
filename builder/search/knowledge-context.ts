import type { KnowledgeRetrievalResult } from "./knowledge-retrieval";

export type KnowledgeContextEvidence = {
  id: string;
  title: string;
  snippet?: string;
  content?: string;
  confidence_score: number;
  source: string;
  source_class: string;
  license_status: string;
  content_hash: string;
  evidence_id: string;
  evidence_provenance_hash: string;
  retrieval_score: number;
};

export type KnowledgeAgentContext = {
  tenant_id: string;
  query: string;
  evidence: KnowledgeContextEvidence[];
  provenance_hashes: string[];
};

/**
 * Converts retrieval results into read-only agent context. It carries
 * provenance forward but performs no authorization or action selection.
 */
export function buildKnowledgeAgentContext(
  result: KnowledgeRetrievalResult,
): KnowledgeAgentContext {
  return {
    tenant_id: result.tenant_id,
    query: result.query,
    evidence: result.items.map(({ record, knowledge, score }) => ({
      id: record.key,
      title: knowledge.title,
      ...(knowledge.snippet ? { snippet: knowledge.snippet } : {}),
      ...(knowledge.content ? { content: knowledge.content } : {}),
      confidence_score: knowledge.confidence_score,
      source: knowledge.provenance.source,
      source_class: knowledge.provenance.source_class,
      license_status: knowledge.provenance.license_status,
      content_hash: knowledge.provenance.content_hash,
      evidence_id: knowledge.provenance.evidence_id,
      evidence_provenance_hash: knowledge.provenance.evidence_provenance_hash,
      retrieval_score: score,
    })),
    provenance_hashes: result.items.map(
      ({ knowledge }) => knowledge.provenance.evidence_provenance_hash,
    ),
  };
}
