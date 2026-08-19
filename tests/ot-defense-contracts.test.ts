import test from "node:test";
import assert from "node:assert/strict";
import {
  AttackAssessment,
  DetectorResult,
  DigitalTwinState,
  PhysicsResidual,
  fuseEvidence,
} from "../lib/ot-defense/contracts";

const asset = {
  tenantId: "tenant-1",
  siteId: "site-swat-1",
  assetId: "pump-101",
  assetType: "PUMP",
};

const now = "2026-08-18T12:00:00.000Z";

test("DigitalTwinState accepts synchronized process state", () => {
  const result = DigitalTwinState.parse({
    schemaVersion: "1.0",
    asset,
    observedAt: now,
    stateVector: { pressure: 10, flow: 4 },
    predictedVector: { pressure: 10.2, flow: 4.1 },
    residualVector: { pressure: -0.2, flow: -0.1 },
    modelVersion: "twin-swat-v1",
    telemetry: [{ name: "pressure", value: 10, unit: "bar", timestamp: now, quality: "GOOD" }],
    synchronizationErrorMs: 8,
  });
  assert.equal(result.asset.assetId, "pump-101");
});

test("PhysicsResidual rejects scores outside the normalized range", () => {
  assert.throws(() => PhysicsResidual.parse({
    asset,
    computedAt: now,
    score: 1.1,
    threshold: 0.7,
    violatedInvariants: [],
    residuals: {},
    modelVersion: "twin-v1",
  }));
});

test("evidence fusion combines physics and detector confidence", () => {
  const physics = PhysicsResidual.parse({
    asset,
    computedAt: now,
    score: 0.9,
    threshold: 0.7,
    violatedInvariants: ["pressure_balance"],
    residuals: { pressure: 3.2 },
    modelVersion: "twin-v1",
  });
  const detector = DetectorResult.parse({
    detectorId: "temporal-ensemble",
    detectorVersion: "1.0.0",
    modality: "TEMPORAL_ML",
    asset,
    observedAt: now,
    anomalyScore: 0.95,
    confidence: 0.9,
    labels: ["REPLAY"],
    evidenceRefs: ["event-1"],
  });
  const fused = fuseEvidence(physics, [detector]);
  assert.ok(fused.fusedScore > 0.9);
  assert.equal(fused.severity, "CRITICAL");
});

test("AttackAssessment is detection evidence only and cannot authorize execution", () => {
  const assessment = AttackAssessment.parse({
    schemaVersion: "1.0",
    assessmentId: "assessment-1",
    asset,
    observedAt: now,
    attackHypotheses: [{ type: "REPLAY", confidence: 0.92, rationale: ["temporal divergence"] }],
    fusedScore: 0.91,
    severity: "CRITICAL",
    detectorResults: [],
    twinModelVersion: "twin-v1",
    provenance: { sourceEventIds: ["event-1"], generatedBy: "ot-evidence-fusion" },
    executionAllowed: false,
  });
  assert.equal(assessment.executionAllowed, false);
});
