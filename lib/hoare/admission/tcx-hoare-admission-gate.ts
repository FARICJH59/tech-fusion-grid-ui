import type { AuthorizationDecision, TCXAdmission, TCXTransaction, VerificationResult } from "@/packages/hoare-contracts/src";
import type { TcxExecutionFenceController } from "../execution/tcx-execution-fence";
import { requireValidTcxLease, type TcxLeaseRepository } from "../execution/tcx-dispatch-governance";
import type { ExecutionTransactionRepository } from "../execution/transaction-repository";

export type HoareAdmissionInput = Readonly<{
  transaction: TCXTransaction;
  authorization: AuthorizationDecision;
  verification: VerificationResult;
  now?: Date;
}>;

export type HoareAdmissionDependencies = Readonly<{
  leases: TcxLeaseRepository;
  fences: TcxExecutionFenceController;
  transactions: ExecutionTransactionRepository;
}>;

/**
 * Concrete fail-closed admission boundary between AEGIS and AgentFusion.
 *
 * Successful admission durably binds the AEGIS decision and verified proof to
 * the current execution attempt using an attempt/state-version CAS. The MQTT
 * transport is not involved and cannot supply or manufacture these bindings.
 */
export class TcxHoareAdmissionGate {
  constructor(private readonly dependencies: HoareAdmissionDependencies) {}

  async admit(input: HoareAdmissionInput): Promise<TCXAdmission> {
    const { transaction, authorization, verification } = input;
    const now = input.now ?? new Date();

    if (!transaction.transactionId || !transaction.attemptId) {
      return this.denied(transaction, "tcx_transaction_identity_invalid", now);
    }
    if (!transaction.leaseId) {
      return this.denied(transaction, "tcx_lease_required", now);
    }
    if (!authorization.requestId || !authorization.allowed || authorization.decision !== "ALLOW") {
      return this.denied(transaction, "aegis_authorization_denied", now);
    }
    if (!verification.verified || !verification.proofId) {
      return this.denied(transaction, "aegis_proof_verification_failed", now);
    }
    if (!authorization.decisionId) {
      return this.denied(transaction, "aegis_decision_identity_invalid", now);
    }
    if (!Number.isInteger(transaction.stateVersion) || transaction.stateVersion < 1 ||
        transaction.expectedStateVersion !== transaction.stateVersion) {
      return this.denied(transaction, "tcx_state_version_invalid", now);
    }

    try {
      const lease = await requireValidTcxLease(transaction as never, this.dependencies.leases, now);
      const fence = await this.dependencies.fences.get(transaction.transactionId, transaction.attemptId);
      if (fence?.state === "FENCED") return this.denied(transaction, "tcx_execution_fenced", now);

      const bound = await this.dependencies.transactions.bindAuthority(
        transaction.transactionId,
        transaction.attemptId,
        authorization.decisionId,
        verification.proofId,
        transaction.stateVersion,
      );

      return {
        transactionId: bound.transactionId,
        attemptId: bound.attemptId,
        admitted: true,
        stateVersion: bound.stateVersion,
        leaseId: lease.leaseId,
        fenceValid: true,
        authorizationDecisionId: authorization.decisionId,
        verificationProofId: verification.proofId,
        admittedAt: now.toISOString(),
        reason: "TCX admission granted and AEGIS authority durably bound",
      };
    } catch (error) {
      return this.denied(transaction, error instanceof Error ? error.message : String(error), now);
    }
  }

  private denied(transaction: TCXTransaction, reason: string, now: Date): TCXAdmission {
    return {
      transactionId: transaction.transactionId,
      attemptId: transaction.attemptId,
      admitted: false,
      stateVersion: transaction.stateVersion,
      leaseId: transaction.leaseId ?? "",
      fenceValid: false,
      authorizationDecisionId: "",
      verificationProofId: "",
      admittedAt: now.toISOString(),
      reason,
    };
  }
}
