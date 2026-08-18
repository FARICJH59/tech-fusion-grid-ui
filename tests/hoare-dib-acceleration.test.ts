import test from "node:test";
import assert from "node:assert/strict";
import { assessDibAcceleration } from "@/lib/hoare/defense/dib/acceleration";
import type { DibProductionRequirement } from "@/lib/hoare/defense/dib/types";

const requirement: DibProductionRequirement = {
  id: "req-001",
  tenantId: "tenant-001",
  programId: "program-001",
  priority: "mission_critical",
  quantity: 100,
  targetDeliveryDate: "2026-10-01",
  identifiedAt: "2026-08-18T00:00:00Z",
  nodes: [
    { id: "gov", name: "Government", type: "government", organizationId: "gov" },
    { id: "mfg", name: "Manufacturer", type: "manufacturer", organizationId: "supplier" },
  ],
  dependencies: [{ fromId: "gov", toId: "mfg", relationship: "supplies", critical: true }],
  constraints: [
    {
      id: "po-1",
      nodeId: "mfg",
      type: "purchase_order",
      description: "PO release delay",
      risk: "high",
      estimatedDelayDays: 12,
      detectedAt: "2026-08-18T00:00:00Z",
      blocking: true,
    },
    {
      id: "inspection-1",
      nodeId: "mfg",
      type: "inspection",
      description: "Inspection scheduling delay",
      risk: "medium",
      estimatedDelayDays: 5,
      detectedAt: "2026-08-18T00:00:00Z",
      blocking: true,
    },
  ],
};

test("DIB assessment identifies blocking bottlenecks and critical path", () => {
  const result = assessDibAcceleration(requirement);
  assert.equal(result.requirementId, "req-001");
  assert.equal(result.totalEstimatedDelayDays, 17);
  assert.equal(result.criticalPath.bottleneckNodeId, "mfg");
  assert.equal(result.governmentToManufacturerPoDays, 12);
  assert.equal(result.risk, "high");
  assert.equal(result.authorizationRequired, true);
  assert.equal(result.recommendedActions.length, 2);
});

test("DIB assessment rejects invalid production requirements", () => {
  assert.throws(
    () => assessDibAcceleration({ ...requirement, quantity: 0 }),
    /INVALID_DIB_REQUIREMENT/,
  );
});

test("non-blocking constraints do not become acceleration actions", () => {
  const result = assessDibAcceleration({
    ...requirement,
    constraints: requirement.constraints.map((constraint) => ({ ...constraint, blocking: false })),
  });
  assert.equal(result.bottlenecks.length, 0);
  assert.equal(result.totalEstimatedDelayDays, 0);
  assert.equal(result.authorizationRequired, false);
});
