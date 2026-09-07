/**
 * Opaque authority presented at a live side-effect boundary.
 *
 * This is deliberately a class rather than a structural interface. Live
 * boundaries can require `instanceof GovernedExecutionAuthority`, so an
 * object received from transport or an arbitrary object literal cannot
 * masquerade as TCX-issued authority.
 *
 * Construction is kept private to this module; TCX obtains instances through
 * `createGovernedExecutionAuthority`, which is used only by the TCX issuer.
 */
export class GovernedExecutionAuthority {
  readonly transactionId: string;
  readonly attemptId: string;
  readonly tenantId: string;
  readonly leaseId: string;
  readonly stateVersion: number;
  readonly authorizationDecisionId: string;
  readonly verificationProofId: string;

  private constructor(input: {
    transactionId: string;
    attemptId: string;
    tenantId: string;
    leaseId: string;
    stateVersion: number;
    authorizationDecisionId: string;
    verificationProofId: string;
    assertValid: () => Promise<void>;
  }) {
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

  static create(input: {
    transactionId: string;
    attemptId: string;
    tenantId: string;
    leaseId: string;
    stateVersion: number;
    authorizationDecisionId: string;
    verificationProofId: string;
    assertValid: () => Promise<void>;
  }): GovernedExecutionAuthority {
    return new GovernedExecutionAuthority(input);
  }
}

export function assertTcxExecutionAuthority(value: unknown): asserts value is GovernedExecutionAuthority {
  if (!(value instanceof GovernedExecutionAuthority)) {
    throw new Error("tcx_execution_authority_not_issuer_created");
  }
}
