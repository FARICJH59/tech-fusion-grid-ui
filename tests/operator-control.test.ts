import test from "node:test";
import assert from "node:assert/strict";

import { OperatorActionQueue } from "../lib/policy/operator-actions";
import { EmergencyControls } from "../lib/policy/emergency-controls";

test("operator controls track approve/reject/modify with audit completeness", () => {
  const queue = new OperatorActionQueue();

  const request = queue.enqueue({
    id: "req-1",
    tenantId: "tenant-1",
    organizationId: "org-1",
    resource: "cloud-run/api",
    requestedAction: "deploy",
    impact: "low",
    riskLevel: "medium",
    aiRecommendation: "proceed",
    approvalStatus: "pending",
    requestedBy: "agent-1",
  });

  queue.modify({
    requestId: request.id,
    tenantId: request.tenantId,
    organizationId: request.organizationId,
    operatorId: "ops-1",
    reason: "raise visibility",
    patch: { impact: "moderate" },
  });
  queue.approve({
    requestId: request.id,
    tenantId: request.tenantId,
    organizationId: request.organizationId,
    operatorId: "ops-1",
    reason: "safe to execute",
  });

  const audit = queue.listAudit();
  assert.equal(audit.length, 2);
  assert.equal(audit.every((event) => Boolean(event.operatorId && event.reason && event.timestamp)), true);
});

test("emergency controls activate emergency stop", () => {
  const controls = new EmergencyControls();
  controls.activate({
    tenantId: "tenant-1",
    organizationId: "org-1",
    resource: "cloud-run/api",
    operatorId: "ops-2",
    reason: "outage containment",
  });

  assert.equal(controls.isActive("tenant-1", "org-1", "cloud-run/api"), true);
});
