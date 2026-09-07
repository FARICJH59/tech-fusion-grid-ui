import assert from "node:assert/strict";
import test from "node:test";
import type { HoareExecutionReceipt } from "../../builder/pasor/hoare-execution-receipt";
import { HoareReceiptEvidenceProvider } from "../../agentfusion/fusion-search/providers/hoare-receipt-provider";

const receipt = (tenant_id: string, receipt_id: string): HoareExecutionReceipt => ({
  schema: "hoare.execution-receipt/v1",
  receipt_id,
  receipt_hash: `${receipt_id}-hash`,
  admission_status: "ADMITTED",
  tenant_id,
  project_id: "project-a",
  workload_id: "workload-a",
  agent_id: "agent-a",
  node_id: "node-a",
  pack_id: "pack-a",
  runtime_kind: "python",
  capabilities: ["compute"],
  command_id: "stabilize-drone",
  parameters: { mode: "bounded" },
  dependencies: [],
  pasor_plan_hash: "plan-a",
  pasor_unit_id: "unit-a",
  simulation_hash: "simulation-a",
  provenance_hash: "provenance-a",
  energy_cost: 1,
  quota_cost: 1,
});

test("receipt provider returns tenant-scoped canonical receipt evidence", async () => {
  const provider = new HoareReceiptEvidenceProvider([
    receipt("tenant-a", "receipt-a"),
    receipt("tenant-b", "receipt-b"),
  ]);

  const results = await provider.search(
    { query: "stabilize-drone", tenantId: "tenant-a", projectId: "project-a" },
    { tenantId: "tenant-a", projectId: "project-a" },
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].evidenceId, "hoare:receipt:receipt-a");
  assert.equal(results[0].contentHash, "receipt-a-hash");
});

test("receipt provider fails closed on query/context tenant mismatch", async () => {
  const provider = new HoareReceiptEvidenceProvider([receipt("tenant-a", "receipt-a")]);
  await assert.rejects(
    provider.search(
      { query: "stabilize-drone", tenantId: "tenant-b" },
      { tenantId: "tenant-a" },
    ),
    /fusion_search_tenant_mismatch/,
  );
});

test("receipt provider never returns foreign-tenant receipts", async () => {
  const provider = new HoareReceiptEvidenceProvider([receipt("tenant-b", "receipt-b")]);
  const results = await provider.search(
    { query: "stabilize-drone", tenantId: "tenant-a" },
    { tenantId: "tenant-a" },
  );
  assert.equal(results.length, 0);
});
