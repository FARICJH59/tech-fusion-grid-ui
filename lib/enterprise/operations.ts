import { agentFusionRuntime } from "@/agentfusion";
import { createDefaultFleetManager } from "@/lib/enterprise/fleet";
import { hoareEnterprisePlatform } from "@/lib/enterprise/platform";
import { autonomousPolicyEngine } from "@/lib/policy/engine";
import { incidentManager } from "@/lib/incidents/incident-manager";
import { reliabilityEngine } from "@/lib/reliability/slo-engine";
import { operatorActionQueue, type OperatorActionRequest } from "@/lib/policy/operator-actions";

export type OperationsSnapshot = {
  timestamp: string;
  fleetStatus: { region: string; healthy: boolean }[];
  deploymentStatus: { runtimeHealth: string; controlPlaneHealth: string };
  telemetry: { providers: number; runtimeServices: number };
  incidents: { open: number };
  runtimeEvents: { queueDepth: number };
  workflowExecution: { active: number };
  aiProviderStatus: { name: string; health: string }[];
  cloudControlCenter: {
    activeDeployments: number;
    autonomousActions: number;
    scalingDecisions: number;
    rollbackHistory: number;
    approvalQueue: number;
    sloHealth: "healthy" | "degraded";
    costOptimizationActions: number;
  };
  agentOperations: {
    activeAgents: number;
    registeredAgents: number;
    executions: number;
    failures: number;
    approvals: number;
    averageLatencyMs: number;
    evaluationScores: { agentId: string; qualityScore: number }[];
    resourceUsage: { agentId: string; tokenUsage: number }[];
  };
  autonomousActionQueue: OperatorActionRequest[];
};

const fleetManager = createDefaultFleetManager();
reliabilityEngine.define({
  id: "operations-default",
  tenantId: "system",
  service: "operations",
  availabilityTarget: 0.999,
  latencyTargetMs: 800,
  errorRateTarget: 0.02,
});

export function createOperationsSnapshot(): OperationsSnapshot {
  const platform = hoareEnterprisePlatform.status();
  const runtimeServices = hoareEnterprisePlatform.runtime.list();
  const policyDecisions = autonomousPolicyEngine.listDecisions();
  const incidents = incidentManager.list();
  const slo = reliabilityEngine.evaluate("operations-default", {
    availability: 0.9995,
    latencyMs: 420,
    errorRate: 0.008,
  });
  const queue = operatorActionQueue.list();
  const agentStatus = agentFusionRuntime.status();

  return {
    timestamp: new Date().toISOString(),
    fleetStatus: fleetManager.snapshot().map((item) => ({ region: item.region, healthy: item.healthy })),
    deploymentStatus: {
      runtimeHealth: platform.health.runtime,
      controlPlaneHealth: platform.health.controlPlane,
    },
    telemetry: {
      providers: platform.architecture.providers.length,
      runtimeServices: runtimeServices.length,
    },
    incidents: { open: incidents.filter((item) => item.status === "open").length },
    runtimeEvents: { queueDepth: queue.length },
    workflowExecution: { active: runtimeServices.filter((item) => item.health === "healthy").length },
    aiProviderStatus: hoareEnterprisePlatform.providers
      .list()
      .map((provider) => ({ name: provider.name, health: provider.health })),
    cloudControlCenter: {
      activeDeployments: runtimeServices.length,
      autonomousActions: policyDecisions.length,
      scalingDecisions: 1,
      rollbackHistory: 0,
      approvalQueue: queue.filter((approval) => approval.approvalStatus === "pending").length,
      sloHealth: slo?.breached ? "degraded" : "healthy",
      costOptimizationActions: hoareEnterprisePlatform.cost.recommend("tenant-1").length,
    },
    agentOperations: {
      activeAgents: agentStatus.activeAgents,
      registeredAgents: agentStatus.registeredAgents,
      executions: agentStatus.executions,
      failures: agentStatus.failures,
      approvals: agentStatus.approvalsPending,
      averageLatencyMs: agentStatus.averageLatencyMs,
      evaluationScores: agentStatus.evaluationScores,
      resourceUsage: agentStatus.resourceUsage,
    },
    autonomousActionQueue: queue,
  };
}
