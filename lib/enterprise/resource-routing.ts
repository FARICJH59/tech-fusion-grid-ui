/**
 * HOARE resource-aware execution routing.
 *
 * This layer evaluates execution candidates against tenant/workload SLOs and
 * resource constraints. It is provider-neutral: telemetry can come from edge,
 * cloud, Triton, Kubernetes, VPP/grid, or other infrastructure adapters.
 *
 * Design date: 2026-09-10
 */

export type ResourceTelemetry = {
  region: string;
  healthy: boolean;
  edgeEnabled: boolean;
  estimatedLatencyMs: number;
  quotaRemaining: number;
  energyWh: number;
  carbonGramsCo2e: number;
  estimatedCostUsd: number;
  capacityUnits: number;
};

export type ResourceRequirements = {
  tenantId: string;
  maxLatencyMs?: number;
  minQuotaRemaining?: number;
  maxEnergyWh?: number;
  maxCarbonGramsCo2e?: number;
  maxCostUsd?: number;
  minCapacityUnits?: number;
  preferEdge?: boolean;
  allowCloud?: boolean;
};

export type ResourceRoute = {
  tenantId: string;
  decision: "ALLOW" | "ESCALATE" | "DENY";
  primary: string | null;
  failover: string | null;
  reason: string[];
  score: number | null;
};

export class ResourceAwareRouter {
  constructor(private telemetry: ResourceTelemetry[]) {}

  snapshot(): ResourceTelemetry[] {
    return [...this.telemetry];
  }

  /** Replace the routing snapshot from a trusted telemetry adapter. */
  ingestTelemetry(telemetry: ResourceTelemetry[]): void {
    this.telemetry = [...telemetry];
  }

  route(requirements: ResourceRequirements): ResourceRoute {
    const eligible = this.telemetry.filter((candidate) => {
      if (!candidate.healthy) return false;
      if (!requirements.allowCloud && !candidate.edgeEnabled) return false;
      if (requirements.maxLatencyMs !== undefined && candidate.estimatedLatencyMs > requirements.maxLatencyMs) return false;
      if (requirements.minQuotaRemaining !== undefined && candidate.quotaRemaining < requirements.minQuotaRemaining) return false;
      if (requirements.maxEnergyWh !== undefined && candidate.energyWh > requirements.maxEnergyWh) return false;
      if (requirements.maxCarbonGramsCo2e !== undefined && candidate.carbonGramsCo2e > requirements.maxCarbonGramsCo2e) return false;
      if (requirements.maxCostUsd !== undefined && candidate.estimatedCostUsd > requirements.maxCostUsd) return false;
      if (requirements.minCapacityUnits !== undefined && candidate.capacityUnits < requirements.minCapacityUnits) return false;
      return true;
    });

    if (eligible.length === 0) {
      return {
        tenantId: requirements.tenantId,
        decision: "ESCALATE",
        primary: null,
        failover: null,
        reason: ["no_execution_candidate_satisfies_requirements"],
        score: null,
      };
    }

    const score = (candidate: ResourceTelemetry): number => {
      const latency = 1 / Math.max(candidate.estimatedLatencyMs, 1);
      const quota = Math.max(candidate.quotaRemaining, 0);
      const energy = 1 / Math.max(candidate.energyWh, 0.001);
      const carbon = 1 / Math.max(candidate.carbonGramsCo2e, 0.001);
      const cost = 1 / Math.max(candidate.estimatedCostUsd, 0.0001);
      const edgeBonus = requirements.preferEdge && candidate.edgeEnabled ? 2 : 0;

      return latency * 1000 + quota + energy * 10 + carbon * 10 + cost + edgeBonus;
    };

    const ranked = [...eligible].sort((a, b) => score(b) - score(a));
    const primary = ranked[0];
    const failover = ranked.find((candidate) => candidate.region !== primary.region) ?? primary;

    return {
      tenantId: requirements.tenantId,
      decision: "ALLOW",
      primary: primary.region,
      failover: failover.region,
      reason: [
        "candidate_satisfies_latency_quota_energy_carbon_cost_constraints",
        requirements.preferEdge && primary.edgeEnabled ? "edge_preferred" : "resource_score_optimized",
      ],
      score: score(primary),
    };
  }
}

export function createDefaultResourceAwareRouter(): ResourceAwareRouter {
  return new ResourceAwareRouter([
    {
      region: "edge-local",
      healthy: true,
      edgeEnabled: true,
      estimatedLatencyMs: 120,
      quotaRemaining: 100,
      energyWh: 0.8,
      carbonGramsCo2e: 2,
      estimatedCostUsd: 0.001,
      capacityUnits: 50,
    },
    {
      region: "us-east1",
      healthy: true,
      edgeEnabled: true,
      estimatedLatencyMs: 850,
      quotaRemaining: 80,
      energyWh: 3.5,
      carbonGramsCo2e: 18,
      estimatedCostUsd: 0.008,
      capacityUnits: 100,
    },
    {
      region: "us-central1",
      healthy: true,
      edgeEnabled: true,
      estimatedLatencyMs: 700,
      quotaRemaining: 90,
      energyWh: 3,
      carbonGramsCo2e: 12,
      estimatedCostUsd: 0.007,
      capacityUnits: 120,
    },
  ]);
}
