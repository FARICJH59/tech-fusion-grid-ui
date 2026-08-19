import assert from "node:assert/strict";
import test from "node:test";
import { DigitalTwinState } from "../lib/ot-defense/contracts";
import { OTDetectionRuntime } from "../lib/ot-defense/detection-runtime";
import { PluggableMLEnsemble, ThresholdSequenceDetector } from "../lib/ot-defense/ml-ensemble";
import { DeterministicPhysicsResidualEngine } from "../lib/ot-defense/physics-residual";

const twin: DigitalTwinState = {
  schemaVersion: "1.0",
  asset: { tenantId: "t1", siteId: "s1", assetId: "pump-1", assetType: "PUMP" },
  observedAt: "2026-08-18T20:00:00.000Z",
  stateVector: { pressure: 10 },
  predictedVector: { pressure: 10 },
  residualVector: { pressure: 0 },
  modelVersion: "twin-v1",
  telemetry: [{ name: "pressure", value: 10, unit: "bar", timestamp: "2026-08-18T20:00:00.000Z", quality: "GOOD" }],
  synchronizationErrorMs: 2,
};

test("physics residual engine produces normalized evidence", () => {
  const result = new DeterministicPhysicsResidualEngine().compute({
    twin,
    observed: { pressure: 12 },
    rules: [{ name: "pressure", threshold: 0.1, scale: 1 }],
  });
  assert.equal(result.score, 1);
  assert.deepEqual(result.violatedInvariants, ["pressure"]);
});

test("phase B runtime fuses physics and ML evidence without execution authority", async () => {
  const runtime = new OTDetectionRuntime(
    new DeterministicPhysicsResidualEngine(),
    new PluggableMLEnsemble([new ThresholdSequenceDetector("temporal-1", "v1")]),
  );
  const assessment = await runtime.assess({
    twin,
    observed: { pressure: 12 },
    observationWindow: { pressure: [10, 11, 12] },
    residualRules: [{ name: "pressure", threshold: 0.1, scale: 1 }],
    sourceEventIds: ["evt-1"],
  });
  assert.equal(assessment.executionAllowed, false);
  assert.ok(assessment.fusedScore >= 0.5);
  assert.ok(assessment.detectorResults.some((d) => d.modality === "PHYSICS"));
  assert.equal(assessment.asset.assetId, "pump-1");
});
