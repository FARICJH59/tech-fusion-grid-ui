import { createHash } from "node:crypto";
import { evaluateReleaseGate, ReleaseGateInput } from "../release/release-gate";

export type SelfTargetMode = "dry-run" | "release";

export interface SelfTargetTransaction {
  transactionId: string;
  target: "hoare";
  mode: SelfTargetMode;
  intent: string;
  candidateRevision: string;
  releaseGate: ReleaseGateInput;
}

export interface SelfTargetDecision {
  transactionId: string;
  target: "hoare";
  mode: SelfTargetMode;
  allowed: boolean;
  reason: string;
}

export function createSelfTargetTransaction(input: Omit<SelfTargetTransaction, "transactionId" | "target">): SelfTargetTransaction {
  const material = JSON.stringify({ target: "hoare", ...input });
  const transactionId = createHash("sha256").update(material).digest("hex");
  return { transactionId, target: "hoare", ...input };
}

export function evaluateSelfTargetTransaction(transaction: SelfTargetTransaction): SelfTargetDecision {
  const gate = evaluateReleaseGate(transaction.releaseGate);
  if (transaction.mode === "dry-run") {
    return {
      transactionId: transaction.transactionId,
      target: "hoare",
      mode: transaction.mode,
      allowed: gate.releasable,
      reason: gate.releasable ? "DRY_RUN_RELEASE_ELIGIBLE" : gate.reason,
    };
  }

  return {
    transactionId: transaction.transactionId,
    target: "hoare",
    mode: transaction.mode,
    allowed: gate.releasable,
    reason: gate.reason,
  };
}
