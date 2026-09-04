import { describe, expect, it } from "vitest";
import { finalizeProductionExecution } from "./production-governed-execution";

const transaction = {
  transactionId: "tx-1",
  attemptId: "attempt-1",
  tenantId: "tenant-1",
  projectId: "project-1",
  expectedStateVersion: 1,
  stateVersion: 1,
  idempotencyKey: "idem-1",
  state: "RUNNING",
};
const authorization = {
  decisionId: "auth-1",
  requestId: "req-1",
  decision: "ALLOW" as const,
  allowed: true,
  policyVersion: "p1",
  reason: "allowed",
  decidedAt: new Date(0).toISOString(),
};
const verification = {
  proofId: "proof-1",
  verified: true,
  verifier: "aegis-z3",
  proofDigest: "proof-digest",
  verifiedAt: new Date(0).toISOString(),
};

function input(observedStateDigest = "state-1") {
  return {
    transaction,
    authorization,
    verification,
    intendedStateDigest: "state-1",
    producerIdentity: "hoare-test",
    runtimeIdentity: "agentfusion-test",
    outcome: {
      receipt: {
        receiptId: "receipt-1",
        receiptHash: "receipt-hash",
        transactionId: "tx-1",
        attemptId: "attempt-1",
        admissionStatus: "ADMITTED" as const,
        producerIdentity: "hoare-test",
        createdAt: new Date(0).toISOString(),
      },
      result: {
        resultId: "result-1",
        resultHash: "result-hash",
        transactionId: "tx-1",
        attemptId: "attempt-1",
        executionId: "exec-1",
        status: "completed" as const,
        observedStateDigest,
        startedAt: new Date(0).toISOString(),
        completedAt: new Date(1).toISOString(),
      },
      attestation: {
        attestationId: "attest-1",
        attestationHash: "attest-hash",
        transactionId: "tx-1",
        attemptId: "attempt-1",
        executionId: "exec-1",
        verifierIdentity: "aegis-test",
        verified: true,
        evidenceDigest: "evidence-digest",
        attestedAt: new Date(1).toISOString(),
      },
    },
    finalizationAuthority: "hoare-commit-authority",
  };
}

describe("production governed execution finalization", () => {
  it("finalizes only after verified evidence and matching reconciliation", async () => {
    const result = await finalizeProductionExecution(input());
    expect(result.evidenceVerification.verified).toBe(true);
    expect(result.reconciliation.matched).toBe(true);
    expect(result.commit?.transactionId).toBe("tx-1");
    expect(result.commit?.attemptId).toBe("attempt-1");
  });

  it("returns no commit when observed state drifts", async () => {
    const result = await finalizeProductionExecution(input("state-drift"));
    expect(result.evidenceVerification.verified).toBe(true);
    expect(result.reconciliation.matched).toBe(false);
    expect(result.commit).toBeUndefined();
    expect(result.reconciliation.recommendedAction).toBe("REPAIR");
  });
});
