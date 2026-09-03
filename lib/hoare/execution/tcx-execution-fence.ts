export type TcxExecutionFenceState = "ACTIVE" | "FENCED";

export type TcxExecutionFence = {
  transactionId: string;
  attemptId: string;
  state: TcxExecutionFenceState;
  reason?: string;
  fencedAt?: string;
};

/**
 * Execution fencing is an asynchronous authority contract because distributed
 * implementations must consult durable state before granting execution.
 * Implementations must preserve monotonic fencing: FENCED never becomes ACTIVE.
 */
export type TcxExecutionFenceController = {
  get(transactionId: string, attemptId: string): Promise<TcxExecutionFence | undefined>;
  fence(transactionId: string, attemptId: string, reason: string): Promise<TcxExecutionFence>;
  assertActive(transactionId: string, attemptId: string): Promise<void>;
};

export class InMemoryTcxExecutionFenceController implements TcxExecutionFenceController {
  private readonly fences = new Map<string, TcxExecutionFence>();

  async get(transactionId: string, attemptId: string): Promise<TcxExecutionFence | undefined> {
    return this.fences.get(this.key(transactionId, attemptId));
  }

  async fence(transactionId: string, attemptId: string, reason: string): Promise<TcxExecutionFence> {
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

  async assertActive(transactionId: string, attemptId: string): Promise<void> {
    const fence = await this.get(transactionId, attemptId);
    if (fence?.state === "FENCED") {
      throw new Error(`tcx_execution_fenced:${fence.reason ?? "execution_fenced"}`);
    }
  }

  private key(transactionId: string, attemptId: string): string {
    return `${transactionId}:${attemptId}`;
  }
}
