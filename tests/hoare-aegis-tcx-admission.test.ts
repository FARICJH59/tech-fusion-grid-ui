import test from "node:test";
import assert from "node:assert/strict";

import { admitGovernedExecution } from "../packages/hoare-admission/src";
import type {
  AuthorizationDecision,
  AuthorizationRequest,
  ProofObligation,
  TCXTransaction,
  VerificationResult,
} from "../packages/hoare-contracts/src";

const request: AuthorizationRequest = {
  requestId: "req-1",
  tenantId: "tenant-1",
  projectId: "project-1",
  identity: "identity-1",
  agentId: "agent-1",
  runtimeCapabilityId: "runtime.deploy",
  requestedAction: "deploy",
  resource: "service/api",
};

const auth: AuthorizationDecision = {
  decisionId: "decision-1",
  requestId: "req-1",
  decision: "ALLOW",
  allowed: true,
  policyVersion: "policy-1",
  reason: "allowed",
  decidedAt: "2026-09-04T00:00:00.000Z",
};

const proof: ProofObligation = {
  proofId: "proof-1",
  precondition: "service exists",
  program: "deploy service",
  postcondition: "service healthy",
  verifier: "aegis-z3",
};

const verification: VerificationResult = {
  proofId: "proof-1",
  verified: true,
  verifier: "aegis-z3",
  proofDigest: "sha256:proof",
  verifiedAt: "2026-09-04T00:00:01.000Z",
};

const transaction: TCXTransaction = {
  transactionId: "tx-1",
  attemptId: "attempt-1",
  tenantId: "tenant-1",
  projectId: "project-1",
  agentId: "agent-1",
  leaseId: "lease-1",
  expectedStateVersion: 3,
  stateVersion: 3,
  idempotencyKey: "idem-1",
  state: "AUTHORIZED",
};

test("AEGIS-TCX admission admits a fully authorized and proven execution", () => {
  const result = admitGovernedExecution({
    authorizationRequest: request,
    authorizationDecision: auth,
    proofObligation: proof,
    verificationResult: verification,
    transaction,
    leaseId: "lease-1",
    fenceValid: true,
    admittedAt: "2026-09-04T00:00:02.000Z",
  });

  assert.equal(result.admitted, true);
  assert.equal(result.admission.transactionId, "tx-1");
  assert.equal(result.admission.attemptId, "attempt-1");
  assert.equal(result.admission.fenceValid, true);
});

test("AEGIS-TCX admission blocks authorization denial", () => {
  const result = admitGovernedExecution({
    authorizationRequest: request,
    authorizationDecision: { ...auth, decision: "DENY", allowed: false },
    proofObligation: proof,
    verificationResult: verification,
    transaction,
    leaseId: "lease-1",
    fenceValid: true,
  });

  assert.equal(result.admitted, false);
  assert.match(result.reason, /authorization_denied/);
});

test("AEGIS-TCX admission blocks proof failure", () => {
  const result = admitGovernedExecution({
    authorizationRequest: request,
    authorizationDecision: auth,
    proofObligation: proof,
    verificationResult: { ...verification, verified: false },
    transaction,
    leaseId: "lease-1",
    fenceValid: true,
  });

  assert.equal(result.admitted, false);
  assert.match(result.reason, /proof_not_verified/);
});

test("AEGIS-TCX admission blocks stale state and invalid fence", () => {
  const result = admitGovernedExecution({
    authorizationRequest: request,
    authorizationDecision: auth,
    proofObligation: proof,
    verificationResult: verification,
    transaction: { ...transaction, stateVersion: 4 },
    leaseId: "lease-1",
    fenceValid: false,
  });

  assert.equal(result.admitted, false);
  assert.match(result.reason, /state_version_mismatch/);
  assert.match(result.reason, /fence_invalid/);
});
