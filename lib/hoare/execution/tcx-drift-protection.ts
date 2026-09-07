import type { ExecutionTransaction } from "./transaction";
import type { ExecutionTransactionRepository } from "./transaction-repository";
import { requireValidTcxLease, type TcxLeaseRepository } from "./tcx-dispatch-governance";

export type TcxDriftKind =
  | "STATE"
  | "POLICY"
  | "CONTEXT"
  | "DEPENDENCY"
  | "TEMPORAL"
  | "INTENT"
  | "EXECUTION";

export type TcxDriftPolicy = {
  enabled?: boolean;
  stateVersionFence?: boolean;
  leaseFence?: boolean;
  artifactDigestFence?: boolean;
  preconditionFence?: boolean;
  deadlineFence?: boolean;
  onDrift?: "FENCE_AND_REPLAN" | "FENCE";
};

export type TcxDriftObservation = {
  kind: TcxDriftKind;
  reason: string;
  expected?: string;
  actual?: string;
};

export type TcxDriftDecision = {
  drifted: boolean;
  observations: readonly TcxDriftObservation[];
  action: "CONTINUE" | "FENCE" | "FENCE_AND_REPLAN";
};

export type TcxDriftDependencies = {
  transactions: ExecutionTransactionRepository;
  leases: TcxLeaseRepository;
};

export function evaluateTcxDrift(
  transaction: ExecutionTransaction,
  current: ExecutionTransaction,
  policy: TcxDriftPolicy = {},
  now = new Date(),
): TcxDriftDecision {
  if (policy.enabled === false) return { drifted: false, observations: [], action: "CONTINUE" };

  const observations: TcxDriftObservation[] = [];

  if (policy.stateVersionFence !== false && current.stateVersion !== transaction.stateVersion) {
    observations.push({
      kind: "STATE",
      reason: "transaction_state_version_changed",
      expected: String(transaction.stateVersion),
      actual: String(current.stateVersion),
    });
  }

  if (policy.artifactDigestFence !== false && current.artifactDigest !== transaction.artifactDigest) {
    observations.push({ kind: "DEPENDENCY", reason: "artifact_digest_changed", expected: transaction.artifactDigest, actual: current.artifactDigest });
  }

  if (policy.preconditionFence !== false && current.preconditionHash !== transaction.preconditionHash) {
    observations.push({ kind: "CONTEXT", reason: "precondition_context_changed", expected: transaction.preconditionHash, actual: current.preconditionHash });
  }

  if (policy.deadlineFence !== false && current.deadline) {
    const deadline = new Date(current.deadline).getTime();
    if (!Number.isFinite(deadline) || now.getTime() > deadline) {
      observations.push({ kind: "TEMPORAL", reason: "execution_deadline_expired", expected: current.deadline, actual: now.toISOString() });
    }
  }

  const action = observations.length === 0
    ? "CONTINUE"
    : policy.onDrift === "FENCE" ? "FENCE" : "FENCE_AND_REPLAN";

  return { drifted: observations.length > 0, observations, action };
}

export async function enforceTcxDriftProtection(
  transactionId: string,
  dependencies: TcxDriftDependencies,
  policy: TcxDriftPolicy = {},
  now = new Date(),
): Promise<TcxDriftDecision> {
  const original = await dependencies.transactions.get(transactionId);
  if (!original) throw new Error("tcx_drift_transaction_not_found");

  if (policy.leaseFence !== false) {
    await requireValidTcxLease(original, dependencies.leases, now);
  }

  const current = await dependencies.transactions.get(transactionId);
  if (!current) throw new Error("tcx_drift_transaction_not_found");

  const decision = evaluateTcxDrift(original, current, policy, now);
  if (!decision.drifted) return decision;

  // Drift is an execution fence. Never mutate the transaction spec merely to
  // make stale work appear current; the repair/replan lifecycle owns recovery.
  throw new Error(`tcx_drift_detected:${decision.action}:${decision.observations.map((o) => o.reason).join(",")}`);
}
