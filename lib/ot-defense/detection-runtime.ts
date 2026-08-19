import { randomUUID } from "node:crypto";
import { AttackAssessment, DetectorResult, DigitalTwinState, PhysicsResidual, fuseEvidence } from "./contracts";
import { MLDetector, MLDetectorInput, PluggableMLEnsemble } from "./ml-ensemble";
import { PhysicsResidualEngine, ResidualRule } from "./physics-residual";

export interface DetectionRuntimeInput {
  twin: DigitalTwinState;
  observed: Record<string, number>;
  observationWindow: Record<string, number[]>;
  residualRules?: ResidualRule[];
  sourceEventIds?: string[];
}

export class OTDetectionRuntime {
  constructor(
    private readonly physics: PhysicsResidualEngine,
    private readonly ensemble: PluggableMLEnsemble,
    private readonly runtimeVersion = "ot-detection-runtime-v1",
  ) {}

  async assess(input: DetectionRuntimeInput): Promise<AttackAssessment> {
    const physicsResult = this.physics.compute({
      twin: input.twin,
      observed: input.observed,
      rules: input.residualRules,
    });

    const detectorResults = await this.ensemble.detect({
      twin: input.twin,
      observationWindow: input.observationWindow,
    });

    const allEvidence: DetectorResult[] = [this.physicsAsDetector(physicsResult), ...detectorResults];
    const { fusedScore, severity } = fuseEvidence(physicsResult, detectorResults);

    const attackHypotheses = this.hypotheses(physicsResult, detectorResults, fusedScore);

    return AttackAssessment.parse({
      schemaVersion: "1.0",
      assessmentId: randomUUID(),
      asset: input.twin.asset,
      observedAt: input.twin.observedAt,
      attackHypotheses,
      fusedScore,
      severity,
      detectorResults: allEvidence,
      twinModelVersion: input.twin.modelVersion,
      provenance: {
        sourceEventIds: input.sourceEventIds ?? [],
        generatedBy: this.runtimeVersion,
      },
      executionAllowed: false,
    });
  }

  private physicsAsDetector(result: PhysicsResidual): DetectorResult {
    return {
      detectorId: `physics:${result.modelVersion}`,
      detectorVersion: result.modelVersion,
      modality: "PHYSICS",
      asset: result.asset,
      observedAt: result.computedAt,
      anomalyScore: result.score,
      confidence: result.violatedInvariants.length ? 1 : 0.5,
      labels: result.violatedInvariants,
      evidenceRefs: result.violatedInvariants.map((name) => `invariant:${name}`),
    };
  }

  private hypotheses(physics: PhysicsResidual, detectors: DetectorResult[], fusedScore: number) {
    const labels = detectors.flatMap((detector) => detector.labels);
    const hypotheses: Array<{ type: "FALSE_DATA_INJECTION" | "REPLAY" | "STEALTH_NULL_SPACE" | "UNKNOWN"; confidence: number; rationale: string[] }> = [];
    if (physics.violatedInvariants.length && fusedScore >= 0.5) {
      hypotheses.push({ type: "FALSE_DATA_INJECTION", confidence: fusedScore, rationale: ["physics residual exceeded configured invariant threshold"] });
    }
    if (labels.some((label) => /replay/i.test(label))) {
      hypotheses.push({ type: "REPLAY", confidence: fusedScore, rationale: ["ensemble produced replay evidence"] });
    }
    if (labels.some((label) => /null|stealth/i.test(label))) {
      hypotheses.push({ type: "STEALTH_NULL_SPACE", confidence: fusedScore, rationale: ["ensemble produced stealth/null-space evidence"] });
    }
    if (!hypotheses.length && fusedScore > 0) {
      hypotheses.push({ type: "UNKNOWN", confidence: fusedScore, rationale: ["anomaly evidence exists without a classified attack hypothesis"] });
    }
    return hypotheses;
  }
}
