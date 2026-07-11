import test from "node:test";
import assert from "node:assert/strict";

import { ApprovalFlow } from "../lib/policy/approval-flow";

test("approval workflow enforces create and update lifecycle", () => {
  const flow = new ApprovalFlow();

  const created = flow.create("tenant-1", "action-1", "pending");
  const approved = flow.update(created.id, "approved", "operator-1", "validated change");

  assert.equal(created.status, "pending");
  assert.equal(approved?.status, "approved");
  assert.equal(approved?.approver, "operator-1");
  assert.equal(flow.list().length, 1);
});
