import { AssetRef, DetectorResult, DigitalTwinState } from "./contracts";

export interface MLDetectorInput {
  twin: DigitalTwinState;
  observationWindow: Record<string, number[]>;
}

export interface MLDetector {
  readonly id: string;
  readonly version: string;
  readonly modality: "TEMPORAL_ML" | "ATTENTION_ML" | "STATISTICAL" | "RULE";
  detect(input: MLDetectorInput): Promise<Omit<DetectorResult, "asset" | "observedAt">> | Omit<DetectorResult, "asset" | "observedAt">;
}

export class PluggableMLEnsemble {
  constructor(private readonly detectors: MLDetector[]) {}

  async detect(input: MLDetectorInput): Promise<DetectorResult[]> {
    const results = await Promise.all(this.detectors.map((detector) => detector.detect(input)));
    const observedAt = input.twin.observedAt;
    return results.map((result) => ({
      ...result,
      asset: AssetRef.parse(input.twin.asset),
      observedAt,
    }));
  }
}

export class ThresholdSequenceDetector implements MLDetector {
  readonly modality = "TEMPORAL_ML" as const;

  constructor(
    public readonly id: string,
    public readonly version: string,
    private readonly threshold = 0.7,
  ) {}

  detect({ twin, observationWindow }: MLDetectorInput): Omit<DetectorResult, "asset" | "observedAt"> {
    const values = Object.values(observationWindow).flat();
    const baseline = Object.values(twin.predictedVector);
    if (!values.length || !baseline.length) {
      return { detectorId: this.id, detectorVersion: this.version, modality: this.modality, anomalyScore: 0, confidence: 0, labels: [], evidenceRefs: [] };
    }
    const meanObserved = values.reduce((a, b) => a + b, 0) / values.length;
    const meanExpected = baseline.reduce((a, b) => a + b, 0) / baseline.length;
    const anomalyScore = Math.min(1, Math.abs(meanObserved - meanExpected) / Math.max(1, Math.abs(meanExpected)));
    return {
      detectorId: this.id,
      detectorVersion: this.version,
      modality: this.modality,
      anomalyScore,
      confidence: Math.min(1, values.length / 20),
      labels: anomalyScore >= this.threshold ? ["SEQUENCE_ANOMALY"] : [],
      evidenceRefs: [`window:${twin.observedAt}`],
    };
  }
}
