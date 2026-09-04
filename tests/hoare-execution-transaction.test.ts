  await assert.rejects(reconciler.reconcile({ schema: "hoare.execution-evidence/v1", transactionId: "tx-4", attemptId: "old-attempt", tenantId: "tenant-1", nodeId: "node-1", receipt: {} as never, result: {} as never, attestation: {} as never, status: "SUCCEEDED", correlationId: "corr-1", emittedAt: new Date().toISOString() }), /attempt_mismatch/);
  assert.equal((await repository.get("tx-4"))?.state, "CREATED");
});

test("invalid transaction state transitions are rejected", async () => {
  const repository = new InMemoryExecutionTransactionRepository(); const coordinator = new ExecutionTransactionCoordinator(repository, new RecordingBus() as never); await coordinator.create(transaction({ transactionId: "tx-5" })); await assert.rejects(coordinator.transition("tx-5", "SUCCEEDED"), /invalid_execution_transaction_transition:CREATED:SUCCEEDED/);
});

test("evidence verifier rejects cross-object identity and hash mismatches", () => {
  const receipt = { receiptId: "receipt-1", receiptHash: "bad", transactionId: "tx-6", attemptId: "attempt-1", admissionStatus: "ADMITTED" as const, producerIdentity: "test", createdAt: new Date(0).toISOString() };
  const result = { resultId: "result-1", resultHash: "bad", transactionId: "tx-other", attemptId: "attempt-1", executionId: "exec-1", status: "completed" as const, startedAt: new Date(0).toISOString() };
  const attestation = { attestationId: "attest-1", attestationHash: "bad", transactionId: "tx-6", attemptId: "attempt-1", executionId: "exec-1", verifierIdentity: "test", verified: true, evidenceDigest: "evidence-digest", attestedAt: new Date(0).toISOString() };
  const verification = verifyExecutionEvidence(receipt, result, attestation);
  assert.equal(verification.verified, false); assert.ok(verification.discrepancies.includes("transaction_id_mismatch")); assert.ok(verification.discrepancies.includes("receipt_hash_mismatch"));
});
