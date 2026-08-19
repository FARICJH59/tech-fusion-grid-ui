import { z } from "zod";

export const AssetRef = z.object({
  tenantId: z.string().min(1),
  siteId: z.string().min(1),
  assetId: z.string().min(1),
  assetType: z.string().min(1),
});
export type AssetRef = z.infer<typeof AssetRef>;

export const TelemetryPoint = z.object({
  name: z.string().min(1),
  value: z.number().finite(),
  unit: z.string().min(1),
  timestamp: z.string().datetime(),
  quality: z.enum(["GOOD", "UNCERTAIN", "BAD"]),
});
export type TelemetryPoint = z.infer<typeof TelemetryPoint>;

export const DigitalTwinState = z.object({
  schemaVersion: z.literal("1.0"),
  asset: AssetRef,
  observedAt: z.string().datetime(),
  stateVector: z.record(z.string(), z.number().finite()),
  predictedVector: z.record(z.string(), z.number().finite()),
  residualVector: z.record(z.string(), z.number().finite()),
  modelVersion: z.string().min(1),
  telemetry: z.array(TelemetryPoint),
  synchronizationErrorMs: z.number().finite().nonnegative(),
});
export type DigitalTwinState = z.infer<typeof DigitalTwinState>;

export const PhysicsResidual = z.object({
  asset: AssetRef,
  computedAt: z.string().datetime(),
  score: z.number().finite().min(0).max(1),
  threshold: z.number().finite().min(0).max(1),
  violatedInvariants: z.array(z.string()),
  residuals: z.record(z.string(), z.number().finite()),
  modelVersion: z.string().min(1),
});
export type PhysicsResidual = z.infer<typeof PhysicsResidual>;

export const DetectorResult = z.object({
  detectorId: z.string().min(1),
  detectorVersion: z.string().min(1),
  modality: z.enum(["PHYSICS", "TEMPORAL_ML", "ATTENTION_ML", "STATISTICAL", "RULE"]),
  asset: AssetRef,
  observedAt: z.string().datetime(),
  anomalyScore: z.number().finite().min(0).max(1),
  confidence: z.number().finite().min(0).max(1),
  labels: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
});
export type DetectorResult = z.infer<typeof DetectorResult>;

export const AttackAssessment = z.object({
  schemaVersion: z.literal("1.0"),
  assessmentId: z.string().min(1),
  asset: AssetRef,
  observedAt: z.string().datetime(),
  attackHypotheses: z.array(z.object({
    type: z.enum(["FALSE_DATA_INJECTION", "REPLAY", "STEALTH_NULL_SPACE", "UNKNOWN"]),
    confidence: z.number().finite().min(0).max(1),
    rationale: z.array(z.string()),
  })),
  fusedScore: z.number().finite().min(0).max(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  detectorResults: z.array(DetectorResult),
  twinModelVersion: z.string().min(1),
  provenance: z.object({
    sourceEventIds: z.array(z.string()),
    generatedBy: z.string().min(1),
  }),
  executionAllowed: z.literal(false),
});
export type AttackAssessment = z.infer<typeof AttackAssessment>;

export function fuseEvidence(
  physics: PhysicsResidual,
  detectors: DetectorResult[],
): Pick<AttackAssessment, "fusedScore" | "severity"> {
  const scores = [physics.score, ...detectors.map((d) => d.anomalyScore)];
  const confidenceWeighted = detectors.reduce(
    (sum, d) => sum + d.anomalyScore * d.confidence,
    physics.score,
  );
  const weight = 1 + detectors.reduce((sum, d) => sum + d.confidence, 0);
  const fusedScore = Math.max(0, Math.min(1, confidenceWeighted / weight));
  const severity = fusedScore >= 0.9 ? "CRITICAL" : fusedScore >= 0.75 ? "HIGH" : fusedScore >= 0.5 ? "MEDIUM" : "LOW";
  return { fusedScore, severity };
}
