import type { TcxLeaseRepository } from "./tcx-dispatch-governance";

export type TcxExecutionFenceState = "ACTIVE" | "FENCED";

export type TcxExecutionFence = {
  transactionId: string;
  attemptId: string;
  state: TcxExecutionFenceState;
  reason?: string;
  fencedAt?: string;
};

export type TcxExecutionAuthorityResult = {
  fence: TcxExecutionFence;
  leaseId: string;
  leaseRevokedAt: string;
};

export type TcxExecutionFenceController = {
  get(transactionId: string, attemptId: string): Promise<TcxExecutionFence | undefined>;
  fence(transactionId: string, attemptId: string, reason: string): Promise<TcxExecutionFence>;
  assertActive(transactionId: string, attemptId: string): Promise<void>;
};

/**
 * Combined authority operation used by governed drift recovery. Implementations
 * MUST make fencing and lease revocation one indivisible authority transition.
 */
export type TcxExecutionAuthorityController = TcxExecutionFenceController & {
  fenceAndRevokeLease(
    transactionId: string,
    attemptId: string,
    leaseId: string,
    reason: string,
    revokedAt: string,
    leases: TcxLeaseRepository,
  ): Promise<TcxExecutionAuthorityResult>;
};

export class InMemoryTcxExecutionFenceController implements TcxExecutionAuthorityController {
  private readonly fences = new Map<string, TcxExecutionFence>();

  async get(transactionId: string, attemptId: string): Promise<TcxExecutionFence | undefined> {
    return this.fences.get(this.key(transactionId, attemptId));
  }

  async fence(transactionId: string, attemptId: string, reason: string): Promise<TcxExecutionFence> {
    const key = this.key(transactionId, attemptId);
    const existing = this.fences.get(key);
    if (existing?.state === "FENCED") return existing;
    const fenced: TcxExecutionFence = { transactionId, attemptId, state: "FENCED", reason, fencedAt: new Date().toISOString() };
    this.fences.set(key, fenced);
    return fenced;
  }

  async fenceAndRevokeLease(transactionId: string, attemptId: string, leaseId: string, reason: string, revokedAt: string, leases: TcxLeaseRepository): Promise<TcxExecutionAuthorityResult> {
    if (!leaseId || !revokedAt) throw new Error("tcx_execution_authority_invalid_request");
    const lease = await leases.get(leaseId);
    if (!lease) throw new Error("tcx_lease_not_found");
    if (lease.leaseId !== leaseId) throw new Error("tcx_lease_identity_mismatch");
    if (lease.transactionId !== transactionId) throw new Error("tcx_lease_transaction_mismatch");
    if (lease.attemptId !== attemptId) throw new Error("tcx_lease_attempt_mismatch");

    // The in-memory implementation has no external concurrency domain. The
    // lease identity is validated before either authority mutation so tests
    // cannot fence an unrelated execution or revoke an unrelated lease.
    const fence = await this.fence(transactionId, attemptId, reason);
    const revoked = await leases.revoke(leaseId, revokedAt);
    return { fence, leaseId: revoked.leaseId, leaseRevokedAt: revoked.revokedAt ?? revokedAt };
  }

  async assertActive(transactionId: string, attemptId: string): Promise<void> {
    const fence = await this.get(transactionId, attemptId);
    if (fence?.state === "FENCED") throw new Error(`tcx_execution_fenced:${fence.reason ?? "execution_fenced"}`);
  }

  private key(transactionId: string, attemptId: string): string { return `${transactionId}:${attemptId}`; }
}
