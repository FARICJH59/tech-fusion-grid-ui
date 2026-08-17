export type SearchSourceType = "web" | "document" | "api" | "repository" | "unknown";

export interface WebSearchRequest {
  tenant_id: string;
  project_id: string;
  query: string;
  location?: string;
  engine?: string;
  limit?: number;
}

export interface SearchEvidence {
  id: string;
  provider: string;
  source_type: SearchSourceType;
  title: string;
  url?: string;
  snippet?: string;
  content?: string;
  acquired_at: string;
  source_published_at?: string;
  relevance_score: number;
  freshness_score: number;
  source_quality_score: number;
  confidence_score: number;
  provenance_hash: string;
}

export interface SearchContradiction {
  field: string;
  evidence_ids: string[];
  values: string[];
}

export interface EvidenceBundle {
  query: string;
  acquired_at: string;
  evidence: SearchEvidence[];
  contradictions: SearchContradiction[];
  confidence_score: number;
  provenance_hash: string;
}

export interface WebSearchResult {
  provider: string;
  query: string;
  location?: string;
  engine: string;
  data: unknown;
  provenance_hash: string;
}

export interface SearchProvider {
  search(request: WebSearchRequest): Promise<WebSearchResult>;
}
