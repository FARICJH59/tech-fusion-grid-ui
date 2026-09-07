import type { FusionEvidence } from "../core/types";

export type FusionEvidenceIndexFilter = Readonly<{
  tenantId: string;
  projectId?: string;
  agentId?: string;
  workloadId?: string;
  transactionId?: string;
  attemptId?: string;
  source?: string;
  sourceType?: string;
  tags?: readonly string[];
  observedFrom?: string;
  observedTo?: string;
  indexedFrom?: string;
  indexedTo?: string;
  limit?: number;
}>;

export type FusionEvidenceIndex = Readonly<{
  put(evidence: FusionEvidence): Promise<void>;
  putMany(evidence: readonly FusionEvidence[]): Promise<void>;
  search(filter: FusionEvidenceIndexFilter, query?: string): Promise<readonly FusionEvidence[]>;
  delete(evidenceId: string, tenantId: string): Promise<boolean>;
}>;

export function assertValidEvidenceIndexFilter(filter: FusionEvidenceIndexFilter): void {
  if (!filter.tenantId) throw new Error("fusion_search_tenant_required");
  for (const value of [filter.observedFrom, filter.observedTo, filter.indexedFrom, filter.indexedTo]) {
    if (value !== undefined && Number.isNaN(Date.parse(value))) throw new Error("fusion_search_invalid_date_filter");
  }
  if (filter.observedFrom && filter.observedTo && Date.parse(filter.observedFrom) > Date.parse(filter.observedTo)) {
    throw new Error("fusion_search_invalid_observed_range");
  }
  if (filter.indexedFrom && filter.indexedTo && Date.parse(filter.indexedFrom) > Date.parse(filter.indexedTo)) {
    throw new Error("fusion_search_invalid_indexed_range");
  }
  if (filter.limit !== undefined && (!Number.isInteger(filter.limit) || filter.limit < 1)) {
    throw new Error("fusion_search_invalid_limit");
  }
}
