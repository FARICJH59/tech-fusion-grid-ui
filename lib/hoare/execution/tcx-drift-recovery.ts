import type { ExecutionTransaction } from "./transaction";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import { ExecutionTransactionCoordinator } from "./transaction-coordinator";
import { evaluateTcxDrift, type TcxDriftDecision, type TcxDriftPolicy } from "./tcx-drift-protection";
import type { TcxExecutionAuthorityController } from "./tcx-execution-fence";
import type { TcxLeaseRepository } from "./tcx-dispatch-governance";

export type TcxDriftRecoveryCallbacks = {
  replan: (transaction: ExecutionTransaction, decision: TcxDriftDecision) => Promise<Partial<ExecutionTransaction>>;
  reauthorize: (transaction: ExecutionTransaction) => Promise<boolean>;
};
export type TcxDriftRecoveryResult = {
  drift: TcxDriftDecision; transaction: ExecutionTransaction; replanned: boolean; reauthorized: boolean;
};

/** Converts detected drift into the existing repair/retry lifecycle. */
export async function recoverFromTcxDrift(
  transactionId: string,
  baseline: ExecutionTransaction,
  repository: ExecutionTransactionRepository,
  callbacks: TcxDriftRecoveryCallbacks,
  maxAttempts: number,
  policy: TcxDriftPolicy = {},
  now = new Date(),
  authorityController?: TcxExecutionAuthorityController,
  leaseRepository?: TcxLeaseRepository,
): Promise<TcxDriftRecoveryResult> {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error("invalid_execution_transaction_max_attempts");
  const current = await repository.get(transactionId);
  if (!current) throw new Error("tcx_drift_transaction_not_found");
  const drift = evaluateTcxDrift(baseline, current, policy, now);
  if (!drift.drifted) return { drift, transaction: current, replanned: false, reauthorized: false };
  if (drift.action === "FENCE") throw new Error(`tcx_drift_fenced:${drift.observations.map((o) => o.reason).join(",")}`);

  const coordinator = new ExecutionTransactionCoordinator(repository);
  let fenced = current;
  if (["DISPATCHED", "ADMITTED", "RUNNING"].includes(fenced.state)) {
    if (!authorityController) throw new Error(`tcx_drift_requires_atomic_authority:${fenced.state}`);
    const reason = drift.observations.map((o) => o.reason).join(",");
    if (fenced.leaseId) {
      if (!leaseRepository) throw new Error("tcx_drift_requires_lease_repository");
      await authorityController.fenceAndRevokeLease(
        fenced.transactionId,
        fenced.attemptId,
        fenced.leaseId,
        reason,
        now.toISOString(),
        leaseRepository,
      );
    } else {
      await authorityController.fence(fenced.transactionId, fenced.attemptId, reason);
    }
    const failureState = fenced.state === "DISPATCHED" ? "DELIVERY_FAILED" : "EXECUTION_FAILED";
    fenced = await coordinator.transition(fenced.transactionId, failureState);
  }
  if (fenced.state !== "REPAIRING") {
    if (!["EXECUTION_FAILED", "TIMEOUT", "REJECTED", "AUTHORIZATION_FAILED", "DELIVERY_FAILED"].includes(fenced.state)) {
      throw new Error(`tcx_drift_recovery_unsupported_state:${fenced.state}`);
    }
    fenced = await coordinator.transition(fenced.transactionId, "REPAIRING");
  }

  const replanned = await callbacks.replan(fenced, drift);
  if (Object.keys(replanned).length > 0) {
    fenced = await repository.update({ ...fenced, ...replanned, state: "REPAIRING", updatedAt: now.toISOString() }, fenced.stateVersion);
  }
  const retry = await coordinator.prepareRetry(fenced.transactionId, maxAttempts, now.toISOString());
  const authorized = await callbacks.reauthorize(retry);
  if (!authorized) return { drift, transaction: retry, replanned: true, reauthorized: false };
  const finalTransaction = await coordinator.transition(retry.transactionId, "AUTHORIZED");
  return { drift, transaction: finalTransaction, replanned: true, reauthorized: true };
}
