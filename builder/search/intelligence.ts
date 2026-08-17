import type { KnowledgeCandidate } from "./knowledge";

export interface KnowledgeQuery {
  tenant_id: string;
  project_id: string;
  query: string;
  limit?: number;
  min_confidence?: number;
}

export interface KnowledgeMatch {
  candidate: KnowledgeCandidate;
  lexical_score: number;
  confidence_score: number;
  freshness_score: number;
  provenance_score: number;
  final_score: number;
}

export interface KnowledgeRetrievalResult {
  query: KnowledgeQuery;
  matches: KnowledgeMatch[];
  contradictions: KnowledgeCandidate[][];
}

function tokenize(value: string): string[] {
  return [...new Set(value.toLowerCase().match(/[a-z0-9]+/g) ?? [])];
}

function lexicalScore(query: string, candidate: KnowledgeCandidate): number {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return 0;

  const text = tokenize([
    candidate.title,
    candidate.snippet ?? "",
    candidate.content ?? "",
  ].join(" "));
  const terms = new Set(text);
  const matched = queryTerms.filter((term) => terms.has(term)).length;
  return matched / queryTerms.length;
}

function provenanceScore(candidate: KnowledgeCandidate): number {
  const provenance = candidate.provenance;
  let score = 0.5;
  if (provenance.source) score += 0.15;
  if (provenance.evidence_id) score += 0.15;
  if (provenance.evidence_provenance_hash) score += 0.2;
  return Math.min(1, score);
}

function freshnessScore(candidate: KnowledgeCandidate, now: number): number {
  const timestamp = Date.parse(candidate.provenance.acquired_at);
  if (!Number.isFinite(timestamp)) return 0.5;
  const ageDays = Math.max(0, (now - timestamp) / 86_400_000);
  return Math.max(0, Math.min(1, Math.exp(-ageDays / 365)));
}

function contradictionGroups(candidates: KnowledgeCandidate[]): KnowledgeCandidate[][] {
  const byUnit = new Map<string, Map<string, KnowledgeCandidate[]>>();

  for (const candidate of candidates) {
    const text = `${candidate.title} ${candidate.snippet ?? ""} ${candidate.content ?? ""}`;
    const values = text.match(/\b\d+(?:\.\d+)?\s*(%|USD|dollars?|million|billion)\b/gi) ?? [];
    for (const raw of values) {
      const match = raw.match(/^(\d+(?:\.\d+)?)\s*(%|USD|dollars?|million|billion)$/i);
      if (!match) continue;
      const unit = match[2].toLowerCase();
      const value = match[1];
      const valueMap = byUnit.get(unit) ?? new Map<string, KnowledgeCandidate[]>();
      const group = valueMap.get(value) ?? [];
      if (!group.some((item) => item.id === candidate.id)) group.push(candidate);
      valueMap.set(value, group);
      byUnit.set(unit, valueMap);
    }
  }

  const contradictions: KnowledgeCandidate[][] = [];
  for (const valueMap of byUnit.values()) {
    if (valueMap.size < 2) continue;
    const candidatesByValue = [...valueMap.values()].map((group) => group[0]).filter(Boolean);
    if (candidatesByValue.length > 1) contradictions.push(candidatesByValue);
  }
  return contradictions;
}

/**
 * Ranks already-acquired, governed knowledge candidates for a tenant/project.
 * This is retrieval intelligence only: it does not search the web, authorize,
 * mutate knowledge, invoke tools, or execute actions.
 */
export function retrieveKnowledge(
  query: KnowledgeQuery,
  candidates: KnowledgeCandidate[],
  now = Date.now(),
): KnowledgeRetrievalResult {
  if (!query.tenant_id) throw new Error("tenant_id is required");
  if (!query.project_id) throw new Error("project_id is required");
  if (!query.query.trim()) throw new Error("query is required");

  const scoped = candidates.filter(
    (candidate) =>
      candidate.tenant_id === query.tenant_id &&
      candidate.project_id === query.project_id &&
      candidate.confidence_score >= (query.min_confidence ?? 0),
  );

  const matches = scoped
    .map((candidate) => {
      const lexical = lexicalScore(query.query, candidate);
      const confidence = Math.max(0, Math.min(1, candidate.confidence_score));
      const freshness = freshnessScore(candidate, now);
      const provenance = provenanceScore(candidate);
      const finalScore = lexical * 0.45 + confidence * 0.30 + freshness * 0.10 + provenance * 0.15;
      return {
        candidate,
        lexical_score: lexical,
        confidence_score: confidence,
        freshness_score: freshness,
        provenance_score: provenance,
        final_score: finalScore,
      };
    })
    .filter((match) => match.lexical_score > 0)
    .sort((a, b) => b.final_score - a.final_score || a.candidate.id.localeCompare(b.candidate.id))
    .slice(0, query.limit ?? 10);

  return {
    query,
    matches,
    contradictions: contradictionGroups(matches.map((match) => match.candidate)),
  };
}
