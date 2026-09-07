import { issueTcxExecutionAuthority } from "@/lib/hoare/runtime/tcx-authority-factory";
import type { ExecutionTransaction } from "@/lib/hoare/execution/transaction";
import type { TcxLease, TcxLeaseRepository } from "@/lib/hoare/execution/tcx-dispatch-governance";
import type { TcxExecutionFenceController } from "@/lib/hoare/execution/tcx-execution-fence";
import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";

type Overrides = Partial<Pick<ExecutionTransaction, "transactionId" | "attemptId" | "tenantId" | "leaseId" | "stateVersion" | "authorizationDecisionId" | "verificationProofId">>;

/** Test-only helper that still obtains a real runtime-branded authority from the TCX issuer. */
export async function createTestTcxAuthority(overrides: Overrides = {}): Promise<GovernedExecutionAuthority> {
  const transaction: ExecutionTransaction = {
    transactionId: overrides.transactionId ?? "tx-test", tenantId: overrides.tenantId ?? "tenant-test", projectId: "project-test",
    releaseDigest: "release-test", artifactDigest: "artifact-test", artifactRef: "artifact-test", pasorPlanHash: "plan-test", pasorUnitId: "unit-test",
    workloadId: "workload-test", agentId: "agent-test", nodeId: "node-test", packId: "pack-test", runtimeKind: "native",
    leaseId: overrides.leaseId ?? "lease-test", authorizationDecisionId: overrides.authorizationDecisionId ?? "decision-test", verificationProofId: overrides.verificationProofId ?? "proof-test",
    attemptId: overrides.attemptId ?? "attempt-test", attemptNumber: 1, idempotencyKey: "idem-test", state: "RUNNING", stateVersion: overrides.stateVersion ?? 1,
    createdAt: "2026-09-06T00:00:00.000Z", updatedAt: "2026-09-06T00:00:00.000Z",
  };
  const transactions = { async get(): Promise<ExecutionTransaction> { return transaction; } } as unknown as Parameters<typeof issueTcxExecutionAuthority>[1]["transactions"];
  const lease: TcxLease = {
    leaseId: transaction.leaseId!, transactionId: transaction.transactionId, attemptId: transaction.attemptId, holderId: transaction.agentId,
    issuedAt: "2026-09-06T00:00:00.000Z", expiresAt: "2099-01-01T00:00:00.000Z",
  };
  const leases = { async get(): Promise<TcxLease | null> { return lease; } } as unknown as TcxLeaseRepository;
  const fence = { async assertActive(): Promise<void> {} } as Pick<TcxExecutionFenceController, "assertActive">;
  return issueTcxExecutionAuthority(transaction.transactionId, { transactions, leases, fence });
}
