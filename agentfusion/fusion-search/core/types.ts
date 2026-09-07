export type FusionSearchMode = "lexical" | "semantic" | "structured" | "temporal" | "hybrid";

export type FusionSearchContext = Readonly<{
  tenantId: string;
  projectId?: string;
  agentId?: string;
  workloadId?: string;
  environment?: string;
  transactionId?: string;
  attemptId?: string;
  authorizationDecisionId?: string;
}>;

export type FusionSearchQuery = Readonly<{
  query: string;
  tenantId: string;
  projectId?: string;
  agentId?: string;
  workloadId?: string;
  mode?: FusionSearchMode;
  sources?: readonly string[];
  tags?: readonly string[];
  timeRange?: Readonly<{ from?: string; to?: string }>;
  limit?: number;
  transactionId?: string;
  attemptId?: string;
}>;

export type FusionEvidence = Readonly<{
  evidenceId: string;
  source: string;
  sourceType: string;
  tenantId: string;
  projectId?: string;
  objectId: string;
  objectVersion?: string;
  content: unknown;
  observedAt: string;
  indexedAt: string;
  contentHash: string;
  relevance: number;
  confidence: number;
  tags?: readonly string[];
  provenance: Readonly<{
    uri?: string;
    transactionId?: string;
    attemptId?: string;
    artifactDigest?: string;
  }>;
}>;

export interface FusionSearchProvider {
  readonly name: string;
  search(query: FusionSearchQuery, context: FusionSearchContext): Promise<readonly FusionEvidence[]>;
}

export function assertFusionTenant(query: FusionSearchQuery, context: FusionSearchContext): void {
  if (!query.tenantId || !context.tenantId || query.tenantId !== context.tenantId) {
    throw new Error("fusion_search_tenant_mismatch");
  }
}

export function clampLimit(limit: number | undefined, fallback = 20, maximum = 100): number {
  if (limit === undefined) return fallback;
  if (!Number.isInteger(limit) || limit < 1) throw new Error("fusion_search_invalid_limit");
  return Math.min(limit, maximum);
}
