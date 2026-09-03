import { createHash } from "node:crypto";
import type { ExecutionTransaction } from "./transaction";

export type TcxLease = {
  leaseId: string;
  transactionId: string;
  attemptId: string;
  holderId: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
};

export type TcxCommitRecord = {
  transactionId: string;
  attemptId: string;
  stateVersion: number;
  preconditionHash: string;
  postconditionHash: string;
  receiptHash?: string;
  attestationHash?: string;
  committedAt: string;
};

export function validateTcxLease(
  transaction: Pick<ExecutionTransaction, "transactionId" | "attemptId" | "leaseId">,
  lease: TcxLease,
  now = new Date(),
): void {
  if (!transaction.leaseId || transaction.leaseId !== lease.leaseId) {
    throw new Error("tcx_lease_mismatch");
  }
  if (transaction.transactionId !== lease.transactionId || transaction.attemptId !== lease.attemptId) {
    throw new Error("tcx_lease_identity_mismatch");
  }

  const issued = Date.parse(lease.issuedAt);
  const expires = Date.parse(lease.expiresAt);
  const current = now.getTime();
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || expires <= issued) {
    throw new Error("tcx_lease_invalid_window");
  }
  if (lease.revokedAt !== undefined) throw new Error("tcx_lease_revoked");
  if (current < issued || current >= expires) throw new Error("tcx_lease_expired");
}

export function buildTcxPreconditionHash(
  transaction: Pick<ExecutionTransaction, "transactionId" | "attemptId" | "stateVersion" | "artifactDigest" | "pasorPlanHash" | "pasorUnitId">,
): string {
  return createHash("sha256")
    .update(JSON.stringify({
      transactionId: transaction.transactionId,
      attemptId: transaction.attemptId,
      stateVersion: transaction.stateVersion,
      artifactDigest: transaction.artifactDigest,
      pasorPlanHash: transaction.pasorPlanHash,
      pasorUnitId: transaction.pasorUnitId,
    }))
    .digest("hex");
}

export function assertTcxPrecondition(
  transaction: Pick<ExecutionTransaction, "preconditionHash">,
  expectedHash: string,
): void {
  if (!transaction.preconditionHash || transaction.preconditionHash !== expectedHash) {
    throw new Error("tcx_precondition_mismatch");
  }
}

export function buildTcxCommitRecord(input: Omit<TcxCommitRecord, "committedAt">, now = new Date().toISOString()): TcxCommitRecord {
  if (!input.transactionId || !input.attemptId || input.stateVersion < 1) {
    throw new Error("tcx_commit_identity_invalid");
  }
  if (!input.preconditionHash || !input.postconditionHash) {
    throw new Error("tcx_commit_evidence_incomplete");
  }
  return { ...input, committedAt: now };
}
