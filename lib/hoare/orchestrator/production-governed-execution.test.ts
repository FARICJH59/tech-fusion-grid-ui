import { createHash } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { finalizeProductionExecution } from "./production-governed-execution";
import { InMemoryExecutionTransactionRepository } from "../execution/transaction-repository";

type Obj = Record<string, unknown>;
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Obj).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  return JSON.stringify(value) as string;
}
function hashWithout(value: Obj, excluded: string): string {
  return createHash("sha256").update(canonicalJson(Object.fromEntries(Object.entries(value).filter(([k]) => k !== excluded)))).digest("hex");
}

const transaction = {
  transactionId: "tx-1", attemptId: "attempt-1", tenantId: "tenant-1", projectId: "project-1",
  expectedStateVersion: 1, stateVersion: 1, idempotencyKey: "idem-1", state: "RUNNING",
};
const authorization = { decisionId: "auth-1", requestId: "req-1", decision: "ALLOW" as const, allowed: true, policyVersion: "p1", reason: "allowed", decidedAt: new Date(0).toISOString() };
const verification = { proofId: "proof-1", verified: true, verifier: "aegis-z3", proofDigest: "proof-digest", verifiedAt: new Date(0).toISOString() };

function input(repository: InMemoryExecutionTransactionRepository, observedStateDigest = "state-1") {
  const receiptBase: Obj = { receipt_id: "receipt-1", transaction_id: "tx-1", attempt_id: "attempt-1", admission_status: "ADMITTED", artifact_digest: undefined, release_digest: undefined, pasor_plan_hash: undefined, pasor_unit_id: undefined, producer_identity: "hoare-test", created_at: new Date(0).toISOString() };
  const receiptHash = hashWithout({ ...receiptBase, receipt_hash: "placeholder" }, "receipt_hash");
  const receipt = { receiptId: "receipt-1", receiptHash, transactionId: "tx-1", attemptId: "attempt-1", admissionStatus: "ADMITTED" as const, producerIdentity: "hoare-test", createdAt: new Date(0).toISOString() };
  const resultBase: Obj = { result_id: "result-1", transaction_id: "tx-1", attempt_id: "attempt-1", execution_id: "exec-1", status: "completed", output_digest: undefined, observed_state_digest: observedStateDigest, started_at: new Date(0).toISOString(), completed_at: new Date(1).toISOString(), error: undefined, receipt_id: receipt.receiptId, receipt_hash: receipt.receiptHash, workload_id: undefined, agent_id: undefined, node_id: undefined, pack_id: undefined, runtime_kind: undefined };
  const resultHash = hashWithout({ ...resultBase, result_hash: "placeholder" }, "result_hash");
  const result = { resultId: "result-1", resultHash, transactionId: "tx-1", attemptId: "attempt-1", executionId: "exec-1", status: "completed" as const, observedStateDigest, startedAt: new Date(0).toISOString(), completedAt: new Date(1).toISOString() };
  const attestationBase: Obj = { attestation_id: "attest-1", transaction_id: "tx-1", attempt_id: "attempt-1", execution_id: "exec-1", verifier_identity: "aegis-test", verified: true, evidence_digest: "evidence-digest", attested_at: new Date(1).toISOString(), reason: undefined, result_id: result.resultId, result_hash: result.resultHash, receipt_id: receipt.receiptId, receipt_hash: receipt.receiptHash };
  const attestationHash = hashWithout({ ...attestationBase, attestation_hash: "placeholder" }, "attestation_hash");
  const attestation = { attestationId: "attest-1", attestationHash, transactionId: "tx-1", attemptId: "attempt-1", executionId: "exec-1", verifierIdentity: "aegis-test", verified: true, evidenceDigest: "evidence-digest", attestedAt: new Date(1).toISOString() };
  return { transaction, authorization, verification, outcome: { receipt, result, attestation }, intendedStateDigest: "state-1", producerIdentity: "hoare-test", runtimeIdentity: "agentfusion-test", finalizationAuthority: "hoare-commit-authority", repository };
}

function repository(): InMemoryExecutionTransactionRepository { return new InMemoryExecutionTransactionRepository(); }

const storedTransaction = {
  transactionId: "tx-1", attemptId: "attempt-1", attemptNumber: 1, idempotencyKey: "idem-1", tenantId: "tenant-1", projectId: "project-1",
  releaseDigest: "release", artifactDigest: "artifact", artifactRef: "artifact-ref", pasorPlanHash: "pasor", pasorUnitId: "unit", workloadId: "workload", agentId: "agent", nodeId: "node", packId: "pack", runtimeKind: "python" as const,
  state: "RUNNING" as const, stateVersion: 1, createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
};

test("production governed execution finalizes only after verified evidence and matching reconciliation", async () => {
  const repo = repository(); await repo.create(storedTransaction);
  const result = await finalizeProductionExecution(input(repo), repo);
  assert.equal(result.evidenceVerification.verified, true);
  assert.equal(result.reconciliation.matched, true);
  assert.equal(result.commit?.transactionId, "tx-1");
  assert.equal(result.transaction?.state, "SUCCEEDED");
  assert.equal(result.transaction?.commitRecordHash, result.commit?.commitRecordHash);
});

test("production governed execution returns no commit when observed state drifts", async () => {
  const repo = repository(); await repo.create(storedTransaction);
  const result = await finalizeProductionExecution(input(repo, "state-drift"), repo);
  assert.equal(result.evidenceVerification.verified, true);
  assert.equal(result.reconciliation.matched, false);
  assert.equal(result.commit, undefined);
  assert.equal(result.reconciliation.recommendedAction, "REPAIR");
  assert.equal((await repo.get("tx-1"))?.state, "RUNNING");
});
