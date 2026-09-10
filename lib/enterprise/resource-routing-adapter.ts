/**
 * Bridges provider telemetry into HOARE resource-aware routing.
 *
 * The adapter keeps telemetry collection separate from routing policy so
 * Triton, edge, cloud, Kubernetes, and grid adapters can be added without
 * changing the core router.
 *
 * Design date: 2026-09-10
 */

import { ResourceAwareRouter, type ResourceRoute, type ResourceRequirements, type ResourceTelemetry } from "@/lib/enterprise/resource-routing";
import { ResourceTelemetryRegistry, type ResourceTelemetryObservation, type ResourceTelemetryProvider } from "@/lib/enterprise/resource-telemetry";

export class ResourceRoutingAdapter {
  constructor(
    private readonly router: ResourceAwareRouter,
    private readonly telemetryRegistry = new ResourceTelemetryRegistry(),
  ) {}

  ingest(observation: ResourceTelemetryObservation): void {
    this.telemetryRegistry.ingest(observation);
    this.syncRouter();
  }

  register(provider: ResourceTelemetryProvider): void {
    this.telemetryRegistry.register(provider);
    this.syncRouter();
  }

  route(requirements: ResourceRequirements): ResourceRoute {
    this.syncRouter();
    return this.router.route(requirements);
  }

  telemetry(): ResourceTelemetryObservation[] {
    return this.telemetryRegistry.snapshot();
  }

  private syncRouter(): void {
    const snapshot: ResourceTelemetry[] = this.telemetryRegistry.snapshot().map(({ observedAt, source, confidence, latencyP95Ms, gpuUtilizationPct, gpuMemoryUtilizationPct, queueDepth, modelAvailability, ...routing }) => routing);
    this.router.ingestTelemetry(snapshot);
  }
}
