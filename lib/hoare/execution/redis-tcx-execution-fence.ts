import { getRedis } from "@/lib/redis";
import type { TcxExecutionFence, TcxExecutionFenceController } from "./tcx-execution-fence";

const PREFIX = "hoare:tcx:execution-fence";

function key(transactionId: string, attemptId: string): string {
  if (!transactionId || !attemptId || transactionId.includes("\u0000") || attemptId.includes("\u0000")) {
    throw new Error("tcx_execution_fence_invalid_identity");
  }
  return `${PREFIX}:${transactionId}:${attemptId}`;
}

/** Distributed TCX fence authority backed by Redis.
 * Fencing is monotonic: once FENCED, the attempt cannot return to ACTIVE.
 */
export class RedisTcxExecutionFenceController implements TcxExecutionFenceController {
  async get(transactionId: string, attemptId: string): Promise<TcxExecutionFence | undefined> {
    const raw = await getRedis().get(key(transactionId, attemptId));
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as TcxExecutionFence;
    } catch (error) {
      throw new Error("tcx_execution_fence_corrupt", { cause: error });
    }
  }

  async fence(transactionId: string, attemptId: string, reason: string): Promise<TcxExecutionFence> {
    if (!reason) throw new Error("tcx_execution_fence_reason_required");
    const k = key(transactionId, attemptId);
    const client = getRedis();
    const fenced: TcxExecutionFence = {
      transactionId,
      attemptId,
      state: "FENCED",
      reason,
      fencedAt: new Date().toISOString(),
    };
    const script = `
      local existing = redis.call("GET", KEYS[1])
      if existing then return existing end
      redis.call("SET", KEYS[1], ARGV[1])
      return ARGV[1]
    `;
    const raw = await client.eval(script, 1, k, JSON.stringify(fenced));
    try {
      return JSON.parse(String(raw)) as TcxExecutionFence;
    } catch (error) {
      throw new Error("tcx_execution_fence_corrupt", { cause: error });
    }
  }

  async assertActive(transactionId: string, attemptId: string): Promise<void> {
    const fence = await this.get(transactionId, attemptId);
    if (fence?.state === "FENCED") {
      throw new Error(`tcx_execution_fenced:${fence.reason ?? "execution_fenced"}`);
    }
  }
}
