/**
 * Autonomous Operations Platform — public API barrel.
 */

export * from "./types";
export { runtimeSupervisor, RuntimeSupervisor } from "./supervisor";
export { selfHealingEngine, SelfHealingEngine } from "./healing";
export { selfHealingEngine as healingEngine } from "./healing"; // alias
export { autonomousDevOps, AutonomousDevOps } from "./devops";
export { costOptimizationEngine, CostOptimizationEngine } from "./cost";
export { fleetManager, FleetManager } from "./fleet";
export { complianceAutomation, ComplianceAutomation } from "./compliance";
export { jobScheduler, JobScheduler } from "./scheduler";
export { gcpOperations, GCPOperations, GCP_PROJECT, GCP_REGION } from "./gcp";
export type { FailureCategory, FailureContext } from "./healing";
export type { PolicyFn } from "./compliance";
export type {
  CloudRunService,
  PubSubMessage,
  SecretRef,
  CloudMonitoringDescriptor,
  WorkloadIdentityConfig,
} from "./gcp";
