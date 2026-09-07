import { getRedis } from "@/lib/redis";
import type { TcxExecutionFence, TcxExecutionAuthorityController, TcxExecutionAuthorityResult } from "./tcx-execution-fence";
import type { TcxLeaseRepository } from "./tcx-dispatch-governance";

const FENCE_PREFIX = "hoare:tcx:execution-fence";
const LEASE_PREFIX = "hoare:tcx:lease";

function identityKey(prefix: string, id: string): string {
  if (!id || id.includes("\u0000")) throw new Error("tcx_execution_fence_invalid_identity");
  return `${prefix}:${id}`;
}
function fenceKey(transactionId: string, attemptId: string): string {
  if (!transactionId || !attemptId || transactionId.includes("\u0000") || attemptId.includes("\u0000")) {
    throw new Error("tcx_execution_fence_invalid_identity");
  }
  return `${FENCE_PREFIX}:${transactionId}:${attemptId}`;
}

/** Distributed TCX fence authority backed by Redis. */
export class RedisTcxExecutionFenceController implements TcxExecutionAuthorityController {
  async get(transactionId: string, attemptId: string): Promise<TcxExecutionFence | undefined> {
    const raw = await getRedis().get(fenceKey(transactionId, attemptId));
    if (raw === null) return undefined;
    try { return JSON.parse(raw) as TcxExecutionFence; }
    catch (error) { throw new Error("tcx_execution_fence_corrupt", { cause: error }); }
  }

  async fence(transactionId: string, attemptId: string, reason: string): Promise<TcxExecutionFence> {
    if (!reason) throw new Error("tcx_execution_fence_reason_required");
    const k = fenceKey(transactionId, attemptId);
    const fenced: TcxExecutionFence = { transactionId, attemptId, state: "FENCED", reason, fencedAt: new Date().toISOString() };
    const raw = await getRedis().eval(`local existing=redis.call("GET",KEYS[1]); if existing then return existing end; redis.call("SET",KEYS[1],ARGV[1]); return ARGV[1]`, 1, k, JSON.stringify(fenced));
    try { return JSON.parse(String(raw)) as TcxExecutionFence; }
    catch (error) { throw new Error("tcx_execution_fence_corrupt", { cause: error }); }
  }

  async fenceAndRevokeLease(transactionId: string, attemptId: string, leaseId: string, reason: string, revokedAt: string, _leases: TcxLeaseRepository): Promise<TcxExecutionAuthorityResult> {
    if (!reason) throw new Error("tcx_execution_fence_reason_required");
    if (!leaseId || !revokedAt) throw new Error("tcx_execution_authority_invalid_request");
    const fk = fenceKey(transactionId, attemptId);
    const lk = identityKey(LEASE_PREFIX, leaseId);
    const fence: TcxExecutionFence = { transactionId, attemptId, state: "FENCED", reason, fencedAt: revokedAt };
    const client = getRedis();
    const script = `
      local existingFence = redis.call("GET", KEYS[1])
      local lease = redis.call("GET", KEYS[2])
      if not lease then return "ERR:tcx_lease_not_found" end

      local leaseObj = cjson.decode(lease)
      if leaseObj.leaseId ~= ARGV[2] then return "ERR:tcx_lease_identity_mismatch" end
      if leaseObj.transactionId ~= ARGV[3] then return "ERR:tcx_lease_transaction_mismatch" end
      if leaseObj.attemptId ~= ARGV[4] then return "ERR:tcx_lease_attempt_mismatch" end

      if not existingFence then
        redis.call("SET", KEYS[1], ARGV[1])
        existingFence = ARGV[1]
      end

      if not leaseObj.revokedAt then
        leaseObj.revokedAt = ARGV[5]
        redis.call("SET", KEYS[2], cjson.encode(leaseObj))
      end

      local finalFence = cjson.decode(existingFence)
      return cjson.encode({ fence = finalFence, leaseId = leaseObj.leaseId, leaseRevokedAt = leaseObj.revokedAt })
    `;
    const raw = await client.eval(
      script,
      2,
      fk,
      lk,
      JSON.stringify(fence),
      leaseId,
      transactionId,
      attemptId,
      revokedAt,
    );
    const text = String(raw);
    const errors: Record<string, string> = {
      "ERR:tcx_lease_not_found": "tcx_lease_not_found",
      "ERR:tcx_lease_identity_mismatch": "tcx_lease_identity_mismatch",
      "ERR:tcx_lease_transaction_mismatch": "tcx_lease_transaction_mismatch",
      "ERR:tcx_lease_attempt_mismatch": "tcx_lease_attempt_mismatch",
    };
    if (errors[text]) throw new Error(errors[text]);
    try { return JSON.parse(text) as TcxExecutionAuthorityResult; }
    catch (error) { throw new Error("tcx_execution_authority_corrupt", { cause: error }); }
  }

  async assertActive(transactionId: string, attemptId: string): Promise<void> {
    const fence = await this.get(transactionId, attemptId);
    if (fence?.state === "FENCED") throw new Error(`tcx_execution_fenced:${fence.reason ?? "execution_fenced"}`);
  }
}
