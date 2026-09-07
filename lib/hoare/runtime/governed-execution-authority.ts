import type { ExecutionTransaction } from "@/lib/hoare/execution/transaction";
import type { ExecutionTransactionRepository } from "@/lib/hoare/execution/transaction-repository";
import type { TcxLeaseRepository } from "@/lib/hoare/execution/tcx-dispatch-governance";
import type { TcxExecutionFenceController } from "@/lib/hoare/execution/tcx-execution-fence";

export type IssueTcxAuthorityDependencies = {
  transactions: ExecutionTransactionRepository;
  leases: TcxLeaseRepository;
  fence: Pick<TcxExecutionFenceController, "assertActive">;
  now?: () => Date;
};

type AuthorityConstructionInput = {
  transactionId: string;
  attemptId: string;
  tenantId: string;
  leaseId: string;
  stateVersion: number;
  authorizationDecisionId: string;
  verificationProofId: string;
  assertValid: () => Promise<void>;
};

/** Opaque authority presented at a live side-effect boundary. */
export class GovernedExecutionAuthority {
  readonly transactionId: string;
  readonly attemptId: string;
  readonly tenantId: string;
  readonly leaseId: string;
  readonly stateVersion: number;
  readonly authorizationDecisionId: string;
  readonly verificationProofId: string;

  private constructor(input: AuthorityConstructionInput) {
    this.transactionId = input.transactionId;
    this.attemptId = input.attemptId;
    this.tenantId = input.tenantId;
    this.leaseId = input.leaseId;
    this.stateVersion = input.stateVersion;
    this.authorizationDecisionId = input.authorizationDecisionId;
    this.verificationProofId = input.verificationProofId;
    this.#assertValid = input.assertValid;
    Object.freeze(this);
  }

  #assertValid: () => Promise<void>;

  async assertValid(): Promise<void> {
    return this.#assertValid();
  }
}

function createIssuedAuthority(input: AuthorityConstructionInput): GovernedExecutionAuthority {
  return new GovernedExecutionAuthority(input);
}

/** Canonical TCX authority issuer. The authority constructor is not exported. */
export async function issueTcxExecutionAuthority(transactionId: string, dependencies: IssueTcxAuthorityDependencies): Promise<GovernedExecutionAuthority> {
  const transaction = await dependencies.transactions.get(transactionId);
  assertIssuableTransaction(transaction);
  const now = (dependencies.now ?? (() => new Date()))();
  const leaseId = transaction.leaseId;
  if (!leaseId) throw new Error("tcx_authority_lease_required");
  const lease = await dependencies.leases.get(leaseId);
  if (!lease || lease.leaseId !== leaseId || lease.transactionId !== transaction.transactionId || lease.attemptId !== transaction.attemptId || lease.tenantId !== transaction.tenantId || lease.revokedAt) throw new Error("tcx_authority_lease_invalid");
  if (Date.parse(lease.expiresAt) <= now.getTime()) throw new Error("tcx_authority_lease_expired");
  await assertFenceActive(dependencies.fence, transaction.transactionId, transaction.attemptId);
  const authorizationDecisionId = transaction.authorizationDecisionId;
  const verificationProofId = transaction.verificationProofId;
  if (!authorizationDecisionId || !verificationProofId) throw new Error("tcx_authority_proof_binding_required");

  return createIssuedAuthority({
    transactionId: transaction.transactionId,
    attemptId: transaction.attemptId,
    tenantId: transaction.tenantId,
    leaseId,
    stateVersion: transaction.stateVersion,
    authorizationDecisionId,
    verificationProofId,
    assertValid: async () => {
      const current = await dependencies.transactions.get(transaction.transactionId);
      if (!current) throw new Error("tcx_authority_transaction_missing");
      if (current.tenantId !== transaction.tenantId) throw new Error("tcx_authority_tenant_mismatch");
      if (current.attemptId !== transaction.attemptId) throw new Error("tcx_authority_attempt_mismatch");
      if (current.state !== "RUNNING") throw new Error("tcx_authority_transaction_not_running");
      if (current.stateVersion !== transaction.stateVersion) throw new Error("tcx_authority_state_version_stale");
      if (current.leaseId !== leaseId) throw new Error("tcx_authority_lease_changed");
      if (current.authorizationDecisionId !== authorizationDecisionId || current.verificationProofId !== verificationProofId) throw new Error("tcx_authority_proof_binding_changed");
      const liveLease = await dependencies.leases.get(leaseId);
      const validationNow = (dependencies.now ?? (() => new Date()))();
      if (!liveLease || liveLease.leaseId !== leaseId || liveLease.transactionId !== current.transactionId || liveLease.attemptId !== current.attemptId || liveLease.tenantId !== current.tenantId || liveLease.revokedAt) throw new Error("tcx_authority_lease_invalid");
      if (Date.parse(liveLease.expiresAt) <= validationNow.getTime()) throw new Error("tcx_authority_lease_expired");
      await assertFenceActive(dependencies.fence, current.transactionId, current.attemptId);
    },
  });
}

async function assertFenceActive(fence: Pick<TcxExecutionFenceController, "assertActive">, transactionId: string, attemptId: string): Promise<void> {
  try { await fence.assertActive(transactionId, attemptId); }
  catch { throw new Error("tcx_authority_fence_invalid"); }
}

function assertIssuableTransaction(transaction: ExecutionTransaction | null): asserts transaction is ExecutionTransaction {
  if (!transaction) throw new Error("tcx_authority_transaction_missing");
  if (transaction.state !== "RUNNING") throw new Error("tcx_authority_transaction_not_running");
  if (!transaction.attemptId || !transaction.tenantId) throw new Error("tcx_authority_identity_incomplete");
}

export function assertTcxExecutionAuthority(value: unknown): asserts value is GovernedExecutionAuthority {
  if (!(value instanceof GovernedExecutionAuthority)) throw new Error("tcx_execution_authority_not_issuer_created");
}
