import type { TCXAdmission, TCXTransaction } from "@/packages/hoare-contracts/src";
import type { ExecutionTransactionRepository } from "../execution/transaction-repository";

/**
 * Stateful persistence boundary for an already-validated AEGIS -> TCX admission.
 *
 * This service is deliberately separate from the pure admission gate: the gate
 * decides whether authority may be granted; this boundary durably binds the
 * resulting AEGIS decision/proof to the exact execution attempt using CAS.
 */
export async function bindTcxAdmissionAuthority(
  transaction: TCXTransaction,
  admission: TCXAdmission,
  repository: ExecutionTransactionRepository,
): Promise<void> {
  if (!admission.admitted) throw new Error("tcx_admission_not_granted");
  if (admission.transactionId !== transaction.transactionId) throw new Error("tcx_admission_transaction_mismatch");
  if (admission.attemptId !== transaction.attemptId) throw new Error("tcx_admission_attempt_mismatch");
  if (!admission.authorizationDecisionId || !admission.verificationProofId) throw new Error("tcx_admission_authority_binding_required");
  if (admission.leaseId !== transaction.leaseId) throw new Error("tcx_admission_lease_mismatch");
  if (admission.stateVersion !== transaction.stateVersion) throw new Error("tcx_admission_state_version_mismatch");

  await repository.bindAuthority(
    transaction.transactionId,
    transaction.attemptId,
    admission.authorizationDecisionId,
    admission.verificationProofId,
    transaction.stateVersion,
  );
}
