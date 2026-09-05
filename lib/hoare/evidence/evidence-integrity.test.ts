import assert from "node:assert/strict";
import test from "node:test";
import {
  createEvidenceEnvelope,
  type EvidenceEnvelopeInput,
  type ExecutionAttestation,
  type ExecutionReceipt,
  type ExecutionResult,
  sha256Canonical,
} from "@/packages/hoare-contracts/src";
import { verifyEvidence } from "./evidence-verifier";
import { verifyExecutionEvidence } from "../execution/evidence-verifier";

const transactionId = "tx_integrity_001";
const attemptId = "attempt_001";
const executionId = "exec_001";

function makeReceipt(): ExecutionReceipt {
  const payload = {
    receipt_id: "receipt_001",
    transaction_id: transactionId,
    attempt_id: attemptId,
    admission_status: "ADMITTED" as const,
    artifact_digest: "artifact_abc",
    release_digest: "release_abc",
    pasor_plan_hash: "pasor_abc",
    pasor_unit_id: "unit_001",
    producer_identity: "agentfusion:test",
    created_at: "2026-09-04T20:00:00.000Z",
  };
  return {
    receiptId: payload.receipt_id,
    receiptHash: sha256Canonical(payload),
    transactionId: payload.transaction_id,
    attemptId: payload.attempt_id,
    admissionStatus: payload.admission_status,
    artifactDigest: payload.artifact_digest,
    releaseDigest: payload.release_digest,
    pasorPlanHash: payload.pasor_plan_hash,
    pasorUnitId: payload.pasor_unit_id,
    producerIdentity: payload.producer_identity,
    createdAt: payload.created_at,
  };
}

function makeResult(receipt: ExecutionReceipt): ExecutionResult {
  const base = {
    result_id: "result_001",
    transaction_id: transactionId,
    attempt_id: attemptId,
    execution_id: executionId,
    status: "completed" as const,
    output_digest: "output_abc",
    observed_state_digest: "state_observed_abc",
    started_at: "2026-09-04T20:00:01.000Z",
    completed_at: "2026-09-04T20:00:02.000Z",
    error: undefined,
    receipt_id: receipt.receiptId,
    receipt_hash: receipt.receiptHash,
    workload_id: undefined,
    agent_id: undefined,
    node_id: undefined,
    pack_id: undefined,
    runtime_kind: undefined,
  };
  return {
    resultId: base.result_id,
    resultHash: sha256Canonical(base),
    transactionId: base.transaction_id,
    attemptId: base.attempt_id,
    executionId: base.execution_id,
    status: base.status,
    outputDigest: base.output_digest,
    observedStateDigest: base.observed_state_digest,
    startedAt: base.started_at,
    completedAt: base.completed_at,
  };
}

function makeAttestation(receipt: ExecutionReceipt, result: ExecutionResult): ExecutionAttestation {
  const base = {
    attestation_id: "attestation_001",
    transaction_id: transactionId,
    attempt_id: attemptId,
    execution_id: executionId,
    verifier_identity: "aegis:test-verifier",
    verified: true,
    evidence_digest: "evidence_placeholder",
    attested_at: "2026-09-04T20:00:03.000Z",
    reason: undefined,
    result_id: result.resultId,
    result_hash: result.resultHash,
    receipt_id: receipt.receiptId,
    receipt_hash: receipt.receiptHash,
  };
  return {
    attestationId: base.attestation_id,
    attestationHash: sha256Canonical(base),
    transactionId: base.transaction_id,
    attemptId: base.attempt_id,
    executionId: base.execution_id,
    verifierIdentity: base.verifier_identity,
    verified: base.verified,
    evidenceDigest: base.evidence_digest,
    attestedAt: base.attested_at,
  };
}

function makeInput(): EvidenceEnvelopeInput {
  const receipt = makeReceipt();
  const result = makeResult(receipt);
  const attestation = makeAttestation(receipt, result);
  return {
    tenantId: "tenant_integrity",
    organizationId: "org_integrity",
    projectId: "project_integrity",
    transactionId,
    attemptId,
    executionId,
    artifactDigest: "artifact_abc",
    releaseDigest: "release_abc",
    pasorPlanHash: "pasor_abc",
    pasorUnitId: "unit_001",
    receipt,
    result,
    attestation,
    intendedStateDigest: "state_intended_abc",
    producerIdentity: "agentfusion:test",
    runtimeIdentity: "runtime:test",
    nodeIdentity: "node:test",
    startedAt: result.startedAt,
    completedAt: result.completedAt,
  };
}

test("valid evidence verifies", () => {
  const input = makeInput();
  const envelope = createEvidenceEnvelope(input);
  const result = verifyEvidence(input, envelope);
  assert.equal(result.verified, true);
  assert.deepEqual(result.reasons, []);
});

test("tampered evidence digest is blocked", () => {
  const input = makeInput();
  const envelope = createEvidenceEnvelope(input);
  const result = verifyEvidence(input, { ...envelope, evidenceDigest: "tampered" });
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes("evidence_digest_mismatch"));
});

for (const field of ["receipt", "result", "attestation"] as const) {
  test(`tampered ${field} is blocked by execution evidence verification`, () => {
    const input = makeInput();
    const tampered = {
      ...input[field],
      ...(field === "receipt" ? { producerIdentity: "attacker" } : {}),
      ...(field === "result" ? { outputDigest: "tampered_output" } : {}),
      ...(field === "attestation" ? { verifierIdentity: "attacker" } : {}),
    } as typeof input[typeof field];

    const receipt = field === "receipt" ? tampered as ExecutionReceipt : input.receipt;
    const result = field === "result" ? tampered as ExecutionResult : input.result;
    const attestation = field === "attestation" ? tampered as ExecutionAttestation : input.attestation;
    const verification = verifyExecutionEvidence(receipt, result, attestation);

    assert.equal(verification.verified, false);
    assert.ok(verification.discrepancies.some((reason) => reason.endsWith("_hash_mismatch")));
  });
}

test("cross-attempt evidence is blocked", () => {
  const input = makeInput();
  const envelope = createEvidenceEnvelope(input);
  const result = verifyEvidence(
    { ...input, attemptId: "attempt_attacker" },
    envelope,
  );
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes("attempt_id_mismatch"));
});
