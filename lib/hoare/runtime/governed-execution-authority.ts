/**
 * Authority presented at a live side-effect boundary.
 *
 * Implementations are issued by TCX after AEGIS authorization and proof
 * verification. Runtime providers must validate the authority immediately
 * before performing a live mutation.
 *
 * The unique-symbol brand prevents ordinary transport/configuration objects
 * from satisfying this contract structurally. Callers must obtain authority
 * from the TCX issuer.
 */
declare const TCX_AUTHORITY_BRAND: unique symbol;

export interface GovernedExecutionAuthority {
  readonly [TCX_AUTHORITY_BRAND]: true;
  readonly transactionId: string;
  readonly attemptId: string;
  readonly tenantId: string;
  readonly leaseId: string;
  readonly stateVersion: number;
  readonly authorizationDecisionId: string;
  readonly verificationProofId: string;
  assertValid(): Promise<void>;
}
