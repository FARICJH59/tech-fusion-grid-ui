import test from "node:test";
import assert from "node:assert/strict";

import {
  assessDIBSupplyChain,
  DIB_SUPPLY_CHAIN_SERVICE,
} from "../lib/enterprise/defense/dib-supply-chain";

test("DIB assessment detects critical supplier exposure and proposes governed actions", () => {
  const assessment = assessDIBSupplyChain({
    nodes: [
      {
        id: "supplier-a",
        type: "supplier",
        name: "Supplier A",
        riskFactors: ["foreign-control", "adversarial-source", "provenance-gap"],
        criticality: 9,
      },
      { id: "component-1", type: "component", name: "Critical Component", criticality: 10 },
      { id: "program-1", type: "program", name: "Program 1" },
    ],
    edges: [
      { from: "supplier-a", to: "component-1", relationship: "supplies" },
      { from: "component-1", to: "program-1", relationship: "supports" },
    ],
  });

  assert.equal(assessment.nodeCount, 3);
  assert.equal(assessment.edgeCount, 2);
  assert.equal(assessment.risks[0].nodeId, "supplier-a");
  assert.equal(assessment.risks[0].severity, "critical");
  assert.ok(assessment.criticalPath.includes("supplier-a"));
  assert.ok(assessment.actions.some((action) => action.action === "supplier-review" && action.requiresApproval));
  assert.ok(assessment.actions.some((action) => action.action === "provenance-request"));
  assert.ok(assessment.actions.some((action) => action.action === "alternate-source-analysis"));
});

test("DIB assessment ignores malformed edges without inventing supply-chain relationships", () => {
  const assessment = assessDIBSupplyChain({
    nodes: [{ id: "supplier-a", type: "supplier", name: "Supplier A" }],
    edges: [{ from: "supplier-a", to: "missing", relationship: "supplies" }],
  });

  assert.equal(assessment.edgeCount, 0);
  assert.equal(assessment.risks[0].score, 0);
  assert.deepEqual(assessment.actions, []);
});

test("DIB service keeps intelligence and execution boundaries explicit", () => {
  assert.equal(DIB_SUPPLY_CHAIN_SERVICE.version, "v1");
  assert.equal(
    DIB_SUPPLY_CHAIN_SERVICE.executionBoundary,
    "HOARE runtime + authorization + runbooks",
  );
});
