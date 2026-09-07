import { createHash } from "node:crypto";
import type { ExecutionTransaction } from "../../../lib/hoare/execution/transaction";
import type { ExecutionTransactionRepository } from "../../../lib/hoare/execution/transaction-repository";
import {
  assertFusionTenant,
  clampLimit,
  type FusionEvidence,
  type FusionSearchContext,
  type FusionSearchProvider,
  type FusionSearchQuery,
} from "../core/types";

/**
 * Read-only bridge from the HOARE transaction ledger into Fusion Search.
 *
 * This provider intentionally exposes transaction state as evidence only.
 * It cannot transition, authorize, dispatch, execute, or mutate a transaction.
 * A transactionId is required because the repository contract is deliberately
 * point-lookup oriented; broad transaction indexing belongs to the durable
 * evidence/index plane rather than the execution repository.
 */
export class HoareTransactionEvidenceProvider implements FusionSearchProvider {
  readonly name = "hoare-transactions";

  constructor(private readonly transactions: ExecutionTransactionRepository) {}

  async search(query: FusionSearchQuery, context: FusionSearchContext): Promise<readonly FusionEvidence[]> {
    assertFusionTenant(query, context);
    if (!query.transactionId) return [];

    const transaction = await this.transactions.get(query.transactionId);
    if (!transaction || transaction.tenantId !== context.tenantId) return [];
    if (query.attemptId && transaction.attemptId !== query.attemptId) return [];
    if (query.projectId && transaction.projectId !== query.projectId) return [];
    if (query.workloadId && transaction.workloadId !== query.workloadId) return [];
    if (query.agentId && transaction.agentId !== query.agentId) return [];

    const evidence = this.toEvidence(transaction, query.query, Boolean(query.transactionId));
    return evidence && this.matchesTimeRange(evidence, query) ? [evidence].slice(0, clampLimit(query.limit)) : [];
  }

  private toEvidence(transaction: ExecutionTransaction, queryText: string, explicitLookup: boolean): FusionEvidence | undefined {
    const content = {
      transactionId: transaction.transactionId,
      attemptId: transaction.attemptId,
      attemptNumber: transaction.attemptNumber,
      state: transaction.state,
      stateVersion: transaction.stateVersion,
      tenantId: transaction.tenantId,
      organizationId: transaction.organizationId,
      projectId: transaction.projectId,
      missionId: transaction.missionId,
      verticalId: transaction.verticalId,
      profileId: transaction.profileId,
      workloadId: transaction.workloadId,
      agentId: transaction.agentId,
      nodeId: transaction.nodeId,
      packId: transaction.packId,
      runtimeKind: transaction.runtimeKind,
      releaseDigest: transaction.releaseDigest,
      artifactDigest: transaction.artifactDigest,
      artifactRef: transaction.artifactRef,
      pasorPlanHash: transaction.pasorPlanHash,
      pasorUnitId: transaction.pasorUnitId,
      leaseId: transaction.leaseId,
      preconditionHash: transaction.preconditionHash,
      deadline: transaction.deadline,
      simulationHash: transaction.simulationHash,
      provenanceHash: transaction.provenanceHash,
      authorizationDecisionId: transaction.authorizationDecisionId,
      verificationProofId: transaction.verificationProofId,
      receiptId: transaction.receiptId,
      receiptHash: transaction.receiptHash,
      resultId: transaction.resultId,
      resultHash: transaction.resultHash,
      attestationId: transaction.attestationId,
      attestationHash: transaction.attestationHash,
      commitRecordHash: transaction.commitRecordHash,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      attemptHistory: transaction.attemptHistory,
    };

    const relevance = explicitLookup ? 1 : this.score(content, queryText);
    if (relevance <= 0) return undefined;

    return {
      evidenceId: `hoare:transaction:${transaction.transactionId}:attempt:${transaction.attemptId}`,
      source: this.name,
      sourceType: "hoare-execution-transaction",
      tenantId: transaction.tenantId,
      projectId: transaction.projectId,
      objectId: transaction.transactionId,
      objectVersion: String(transaction.stateVersion),
      content,
      observedAt: transaction.updatedAt,
      indexedAt: new Date().toISOString(),
      contentHash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
      relevance,
      confidence: 1,
      provenance: {
        transactionId: transaction.transactionId,
        attemptId: transaction.attemptId,
        artifactDigest: transaction.artifactDigest,
      },
    };
  }

  private matchesTimeRange(evidence: FusionEvidence, query: FusionSearchQuery): boolean {
    const observed = Date.parse(evidence.observedAt);
    const { from, to } = query.timeRange ?? {};
    if (from && observed < Date.parse(from)) return false;
    if (to && observed > Date.parse(to)) return false;
    return true;
  }

  private score(value: unknown, query: string): number {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return 1;
    const text = JSON.stringify(value).toLowerCase();
    return terms.filter((term) => text.includes(term)).length / terms.length;
  }
}
