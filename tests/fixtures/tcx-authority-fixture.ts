import type { GovernedExecutionAuthority } from "@/lib/hoare/runtime/governed-execution-authority";

/** Test-only authority fixture. Production code must obtain authority from TCX. */
export function createTestTcxAuthority(
  overrides: Partial<GovernedExecutionAuthority> = {},
): GovernedExecutionAuthority {
  return {
    transactionId: "tx-test",
    attemptId: "attempt-test",
    tenantId: "tenant-test",
    leaseId: "lease-test",
    stateVersion: 1,
    authorizationDecisionId: "decision-test",
    verificationProofId: "proof-test",
    assertValid: async () => undefined,
    ...overrides,
  };
}
