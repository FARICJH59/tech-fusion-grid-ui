import { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";

/** Test-only authority fixture. Production code must obtain authority from TCX. */
export function createTestTcxAuthority(
  overrides: Partial<Pick<GovernedExecutionAuthority, "transactionId" | "attemptId" | "tenantId" | "leaseId" | "stateVersion" | "authorizationDecisionId" | "verificationProofId">> & { assertValid?: () => Promise<void> } = {},
): GovernedExecutionAuthority {
  return GovernedExecutionAuthority.create({
    transactionId: overrides.transactionId ?? "tx-test",
    attemptId: overrides.attemptId ?? "attempt-test",
    tenantId: overrides.tenantId ?? "tenant-test",
    leaseId: overrides.leaseId ?? "lease-test",
    stateVersion: overrides.stateVersion ?? 1,
    authorizationDecisionId: overrides.authorizationDecisionId ?? "decision-test",
    verificationProofId: overrides.verificationProofId ?? "proof-test",
    assertValid: overrides.assertValid ?? (async () => undefined),
  });
}
