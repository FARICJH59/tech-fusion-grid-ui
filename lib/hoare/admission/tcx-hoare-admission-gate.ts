import type { AuthorizationDecision, ProofVerificationResult, TCXAdmission, TCXTransaction } from "@/packages/hoare-contracts/src";
import type { TcxExecutionFenceController } from "../execution/tcx-execution-fence";
import { requireValidTcxLease, type TcxLeaseRepository } from "../execution/tcx-dispatch-governance";

export type HoareAdmissionInput = Readonly<{
  transaction: TCXTransaction;
  authorization: AuthorizationDecision;
  verification: ProofVerificationResult;
  now?: Date;
}>;

export type HoareAdmissionDependencies = Readonly<{
  leases: TcxLeaseRepository;
  fences: TcxExecutionFenceController;
}>;

/**
 * Concrete fail-closed admission boundary between AEGIS and AgentFusion.
 *
 * This gate does not manufacture authority, proof, leases, or transactions.
 * Those artifacts must already exist and be supplied by their authoritative
 * subsystems. The gate only composes and validates them into TCX admission.
 */
export class TcxHoareAdmissionGate {
  constructor(private readonly dependencies: HoareAdmissionDependencies) {}

  async admit(input: HoareAdmissionInput): Promise<TCXAdmission> {
    const { transaction, authorization, verification } = input;
    const now = input.now ?? new Date();

    if (!transaction.transactionId || !transaction.attemptId) {
      return this.denied(transaction, "tcx_transaction_identity_invalid");
    }
    if (!transaction.leaseId) {
      return this.denied(transaction, "tcx_lease_required");
    }
    if (authorization.requestId !== transaction.transactionId || !authorization.allowed) {
      return this.denied(transaction, "aegis_authorization_denied");
    }
    if (!verification.verified || verification.proofId.length === 0) {
      return this.denied(transaction, "aegis_proof_verification_failed");
    }
    if (!Number.isInteger(transaction.stateVersion) || transaction.stateVersion < 1 ||
        transaction.expectedStateVersion !== transaction.stateVersion) {
      return this.denied(transaction, "tcx_state_version_invalid");
    }

    try {
      const lease = await requireValidTcxLease(transaction as never, this.dependencies.leases, now);
      const fence = await this.dependencies.fences.get(transaction.transactionId, transaction.attemptId);
      if (fence?.state === "FENCED") return this.denied(transaction, "tcx_execution_fenced");

      return {
        transactionId: transaction.transactionId,
        attemptId: transaction.attemptId,
        admitted: true,
        stateVersion: transaction.stateVersion,
        leaseId: lease.leaseId,
        fenceValid: true,
        authorizationDecisionId: authorization.decisionId,
        verificationProofId: verification.proofId,
        admittedAt: now.toISOString(),
        reason: "TCX admission granted",
      };
    } catch (error) {
      return this.denied(transaction, error instanceof Error ? error.message : String(error));
    }
  }

  private denied(transaction: TCXTransaction, reason: string): TCXAdmission {
    return {
      transactionId: transaction.transactionId,
      attemptId: transaction.attemptId,
      admitted: false,
      stateVersion: transaction.stateVersion,
      leaseId: transaction.leaseId ?? "",
      fenceValid: false,
      authorizationDecisionId: "",
      verificationProofId: "",
      admittedAt: new Date().toISOString(),
      reason,
    };
  }
}
