import { AgentMemoryRuntime } from "../../agentfusion/memory/memory-runtime";
import type { MemoryRecord } from "../../packages/agent-sdk/src/memory";
import type { KnowledgeAcquisitionResult, KnowledgeCandidate } from "./knowledge";

export type KnowledgeMemoryValue = {
  kind: "knowledge-candidate";
  title: string;
  url?: string;
  content?: string;
  snippet?: string;
  confidence_score: number;
  provenance: KnowledgeCandidate["provenance"];
};

function toRecord(
  candidate: KnowledgeCandidate,
  acquiredAt: string,
): MemoryRecord {
  return {
    key: `knowledge:${candidate.id}`,
    value: {
      kind: "knowledge-candidate",
      title: candidate.title,
      ...(candidate.url ? { url: candidate.url } : {}),
      ...(candidate.content ? { content: candidate.content } : {}),
      ...(candidate.snippet ? { snippet: candidate.snippet } : {}),
      confidence_score: candidate.confidence_score,
      provenance: candidate.provenance,
    },
    tier: "long-term",
    tenantId: candidate.tenant_id,
    tags: [
      "knowledge",
      "provenance",
      `source:${candidate.provenance.source_class}`,
      `license:${candidate.provenance.license_status}`,
    ],
    updatedAt: acquiredAt,
  };
}

/**
 * Bridges governed Fusion Search knowledge into the existing Agent Memory
 * runtime. This is persistence only; it does not authorize, execute, or
 * reinterpret the knowledge candidate.
 */
export async function persistKnowledgeAcquisition(
  result: KnowledgeAcquisitionResult,
  memory: AgentMemoryRuntime = new AgentMemoryRuntime(),
): Promise<MemoryRecord[]> {
  const records = result.candidates.map((candidate) =>
    toRecord(candidate, result.acquired_at),
  );

  for (const record of records) {
    await memory.writeTenantKnowledge({
      key: record.key,
      value: record.value,
      tenantId: record.tenantId,
      tags: record.tags,
      updatedAt: record.updatedAt,
    });
  }

  return records;
}
