import type { HoareExecutionReceipt } from "../../../builder/pasor/hoare-execution-receipt";
import {
  assertFusionTenant,
  clampLimit,
  type FusionEvidence,
  type FusionSearchContext,
  type FusionSearchProvider,
  type FusionSearchQuery,
} from "../core/types";

/**
 * Read-only adapter over canonical HOARE execution receipts.
 *
 * Receipts are evidence, not authority. This provider never authorizes,
 * dispatches, executes, or mutates a workload and never exposes credentials.
 */
export class HoareReceiptEvidenceProvider implements FusionSearchProvider {
  readonly name = "hoare-receipts";

  constructor(private readonly receipts: readonly HoareExecutionReceipt[]) {}

  async search(query: FusionSearchQuery, context: FusionSearchContext): Promise<readonly FusionEvidence[]> {
    assertFusionTenant(query, context);

    const matches = this.receipts.filter((receipt) => {
      if (receipt.tenant_id !== context.tenantId) return false;
      if (query.projectId && receipt.project_id !== query.projectId) return false;
      if (query.workloadId && receipt.workload_id !== query.workloadId) return false;
      if (query.agentId && receipt.agent_id !== query.agentId) return false;
      if (query.transactionId || query.attemptId) return false;
      return this.matchesQuery(receipt, query.query);
    });

    return matches.slice(0, clampLimit(query.limit)).map((receipt) => this.toEvidence(receipt, query.query));
  }

  private toEvidence(receipt: HoareExecutionReceipt, queryText: string): FusionEvidence {
    const observedAt = new Date().toISOString();
    return {
      evidenceId: `hoare:receipt:${receipt.receipt_id}`,
      source: this.name,
      sourceType: "hoare-execution-receipt",
      tenantId: receipt.tenant_id,
      projectId: receipt.project_id,
      objectId: receipt.receipt_id,
      objectVersion: receipt.receipt_hash,
      content: receipt,
      observedAt,
      indexedAt: observedAt,
      contentHash: receipt.receipt_hash,
      relevance: this.score(receipt, queryText),
      confidence: 1,
      provenance: {},
    };
  }

  private matchesQuery(receipt: HoareExecutionReceipt, queryText: string): boolean {
    if (!queryText.trim()) return true;
    return this.score(receipt, queryText) > 0;
  }

  private score(receipt: HoareExecutionReceipt, queryText: string): number {
    const terms = queryText.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return 1;
    const text = JSON.stringify(receipt).toLowerCase();
    return terms.filter((term) => text.includes(term)).length / terms.length;
  }
}
