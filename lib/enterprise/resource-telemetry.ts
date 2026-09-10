/**
 * Provider-neutral telemetry contract for HOARE resource-aware routing.
 *
 * Adapters can publish observations from Triton, edge devices, cloud
 * providers, Kubernetes, VPP/grid systems, or other execution planes.
 * Routing remains independent of any one telemetry vendor or runtime.
 *
 * Design date: 2026-09-10
 */

import type { ResourceTelemetry } from "@/lib/enterprise/resource-routing";

export type ResourceTelemetryObservation = ResourceTelemetry & {
  observedAt: string;
  source: string;
  confidence: number;
  latencyP95Ms?: number;
  gpuUtilizationPct?: number;
  gpuMemoryUtilizationPct?: number;
  queueDepth?: number;
  modelAvailability?: string[];
};

export interface ResourceTelemetryProvider {
  readonly name: string;
  snapshot(): ResourceTelemetryObservation[];
}

export class ResourceTelemetryRegistry {
  private observations = new Map<string, ResourceTelemetryObservation>();

  register(provider: ResourceTelemetryProvider): void {
    for (const observation of provider.snapshot()) {
      this.ingest(observation);
    }
  }

  ingest(observation: ResourceTelemetryObservation): void {
    if (!observation.region) throw new Error("telemetry_region_required");
    if (!observation.source) throw new Error("telemetry_source_required");
    if (!observation.observedAt) throw new Error("telemetry_observed_at_required");
    if (observation.confidence < 0 || observation.confidence > 1) {
      throw new Error("telemetry_confidence_out_of_range");
    }
    if (!Number.isFinite(Date.parse(observation.observedAt))) {
      throw new Error("telemetry_observed_at_invalid");
    }

    this.observations.set(this.key(observation), { ...observation });
  }

  snapshot(): ResourceTelemetryObservation[] {
    return [...this.observations.values()].sort((a, b) => a.region.localeCompare(b.region));
  }

  clear(): void {
    this.observations.clear();
  }

  private key(observation: ResourceTelemetryObservation): string {
    return `${observation.source}:${observation.region}`;
  }
}

export class StaticResourceTelemetryProvider implements ResourceTelemetryProvider {
  readonly name = "static";

  constructor(private readonly observations: ResourceTelemetryObservation[]) {}

  snapshot(): ResourceTelemetryObservation[] {
    return this.observations.map((observation) => ({ ...observation }));
  }
}
