import type { ExecutionTransaction } from "@/lib/hoare/execution/transaction";
import type { ExecutionTransactionRepository } from "@/lib/hoare/execution/transaction-repository";
import type { GovernedExecutionAuthority } from "./governed-execution-authority";

export type TcxAuthorityLease = {
  id: string;
  transactionId: string;
  attemptId: string;
  tenantId: string;
  expiresAt: string;
  revoked?: boolean;
};

export interface TcxAuthorityLeaseStore {
  get(leaseId: string): Promise<TcxAuthorityLease | null>;
}

export interface TcxAuthorityFence {
  isActive(transactionId: string, attemptId: string): Promise<boolean>;
}

export type IssueTcxAuthorityDependencies = {
  transactions: ExecutionTransactionRepository;
  leases: TcxAuthorityLeaseStore;
  fence: TcxAuthorityFence;
  now?: () => Date;
};

/**
 * TCX-only authority issuer. The returned object is intentionally created
 * here rather than accepted from an API payload or transport envelope.
 */
export async function issueTcxExecutionAuthority(
  transactionId: string,
  dependencies: IssueTcxAuthorityDependencies,
): Promise<GovernedExecutionAuthority> {
  const transaction = await dependencies.transactions.get(transactionId);
  assertIssuableTransaction(transaction);

  const now = (dependencies.now ?? (() => new Date()))();
  const leaseId = transaction.leaseId;
  if (!leaseId) throw new Error("tcx_authority_lease_required");

  const lease = await dependencies.leases.get(leaseId);
  if (!lease || lease.revoked || lease.transactionId !== transaction.transactionId || lease.attemptId !== transaction.attemptId || lease.tenantId !== transaction.tenantId) {
    throw new Error("tcx_authority_lease_invalid");
  }
  if (Date.parse(lease.expiresAt) <= now.getTime()) throw new Error("tcx_authority_lease_expired");

  if (!(await dependencies.fence.isActive(transaction.transactionId, transaction.attemptId))) {
    throw new Error("tcx_authority_fence_invalid");
  }

  const authorizationDecisionId = transaction.authorizationDecisionId;
  const verificationProofId = transaction.verificationProofId;
  if (!authorizationDecisionId || !verificationProofId) {
    throw new Error("tcx_authority_proof_binding_required");
  }

  const snapshot: GovernedExecutionAuthority = Object.freeze({
    transactionId: transaction.transactionId,
    attemptId: transaction.attemptId,
    tenantId: transaction.tenantId,
    leaseId,
    stateVersion: transaction.stateVersion,
    authorizationDecisionId,
    verificationProofId,
    assertValid: async () => {
      const current = await dependencies.transactions.get(transaction.transactionId);
      if (!current) throw new Error("tcx_authority_transaction_missing");
      if (current.tenantId !== transaction.tenantId) throw new Error("tcx_authority_tenant_mismatch");
      if (current.attemptId !== transaction.attemptId) throw new Error("tcx_authority_attempt_mismatch");
      if (current.state !== "RUNNING") throw new Error("tcx_authority_transaction_not_running");
      if (current.stateVersion !== transaction.stateVersion) throw new Error("tcx_authority_state_version_stale");
      if (current.leaseId !== leaseId) throw new Error("tcx_authority_lease_changed");
      if (current.authorizationDecisionId !== authorizationDecisionId || current.verificationProofId !== verificationProofId) {
        throw new Error("tcx_authority_proof_binding_changed");
      }

      const liveLease = await dependencies.leases.get(leaseId);
      const validationNow = (dependencies.now ?? (() => new Date()))();
      if (!liveLease || liveLease.revoked || liveLease.transactionId !== current.transactionId || liveLease.attemptId !== current.attemptId || liveLease.tenantId !== current.tenantId) {
        throw new Error("tcx_authority_lease_invalid");
      }
      if (Date.parse(liveLease.expiresAt) <= validationNow.getTime()) throw new Error("tcx_authority_lease_expired");
      if (!(await dependencies.fence.isActive(current.transactionId, current.attemptId))) {
        throw new Error("tcx_authority_fence_invalid");
      }
    },
  });

  return snapshot;
}

function assertIssuableTransaction(transaction: ExecutionTransaction | null): asserts transaction is ExecutionTransaction {
  if (!transaction) throw new Error("tcx_authority_transaction_missing");
  if (transaction.state !== "RUNNING") throw new Error("tcx_authority_transaction_not_running");
  if (!transaction.attemptId || !transaction.tenantId) throw new Error("tcx_authority_identity_incomplete");
}
