/**
 * Authority presented at a live side-effect boundary.
 *
 * Implementations must be issued by TCX after AEGIS authorization and proof
 * verification. Runtime providers must validate the authority immediately
 * before performing a live mutation.
 */
export interface GovernedExecutionAuthority {
  readonly transactionId: string;
  readonly attemptId: string;
  readonly tenantId: string;
  readonly leaseId: string;
  readonly stateVersion: number;
  readonly authorizationDecisionId: string;
  readonly verificationProofId: string;
  assertValid(): Promise<void>;
}
