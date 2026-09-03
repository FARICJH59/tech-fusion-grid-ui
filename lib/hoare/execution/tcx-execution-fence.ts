export type TcxExecutionFenceState = "ACTIVE" | "FENCED";

export type TcxExecutionFence = {
  transactionId: string;
  attemptId: string;
  state: TcxExecutionFenceState;
  reason?: string;
  fencedAt?: string;
};

export type TcxExecutionFenceController = {
  get(transactionId: string, attemptId: string): TcxExecutionFence | undefined;
  fence(transactionId: string, attemptId: string, reason: string): TcxExecutionFence;
  assertActive(transactionId: string, attemptId: string): void;
};

export class InMemoryTcxExecutionFenceController implements TcxExecutionFenceController {
  private readonly fences = new Map<string, TcxExecutionFence>();

  get(transactionId: string, attemptId: string): TcxExecutionFence | undefined {
    return this.fences.get(this.key(transactionId, attemptId));
  }

  fence(transactionId: string, attemptId: string, reason: string): TcxExecutionFence {
    const key = this.key(transactionId, attemptId);
    const existing = this.fences.get(key);
    if (existing?.state === "FENCED") {
      return existing;
    }

    const fenced: TcxExecutionFence = {
      transactionId,
      attemptId,
      state: "FENCED",
      reason,
      fencedAt: new Date().toISOString(),
    };
    this.fences.set(key, fenced);
    return fenced;
  }

  assertActive(transactionId: string, attemptId: string): void {
    const fence = this.get(transactionId, attemptId);
    if (fence?.state === "FENCED") {
      throw new Error(`tcx_execution_fenced:${fence.reason ?? "execution_fenced"}`);
    }
  }

  private key(transactionId: string, attemptId: string): string {
    return `${transactionId}:${attemptId}`;
  }
}
