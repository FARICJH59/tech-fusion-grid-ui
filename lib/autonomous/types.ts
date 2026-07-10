/**
 * Shared types for the Autonomous Operations Platform (Phase 6).
 */

export type ServiceId = string;
export type ServiceStatus = "starting" | "running" | "stopping" | "stopped" | "degraded" | "failed";
export type DeploymentStrategy = "rolling" | "canary" | "blue-green";
export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "open" | "investigating" | "resolved";
export type FleetNodeType = "edge" | "raspberry-pi" | "jetson" | "docker" | "kubernetes" | "cloud-run";
export type ComplianceStatus = "compliant" | "warning" | "violation";
export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export type ServiceRegistration = {
  id: ServiceId;
  name: string;
  version: string;
  status: ServiceStatus;
  dependencies?: ServiceId[];
  restartPolicy?: "always" | "on-failure" | "never";
  maxRestarts?: number;
  healthCheckIntervalMs?: number;
  registeredAt: string;
  lastHealthCheck?: string;
  restartCount: number;
  tenantId?: string;
};

export type DeploymentPlan = {
  id: string;
  serviceId: ServiceId;
  fromVersion: string;
  toVersion: string;
  strategy: DeploymentStrategy;
  status: "pending" | "in-progress" | "completed" | "failed" | "rolled-back";
  canaryWeight?: number;
  createdAt: string;
  completedAt?: string;
  approvedBy?: string;
  rollbackTriggeredAt?: string;
};

export type Incident = {
  id: string;
  serviceId?: ServiceId;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  remediationActions: RemediationAction[];
  createdAt: string;
  resolvedAt?: string;
  tenantId?: string;
};

export type RemediationAction = {
  id: string;
  type: "restart" | "rollback" | "scale" | "circuit-break" | "dead-letter" | "notify";
  status: "pending" | "running" | "completed" | "failed";
  description: string;
  executedAt?: string;
  result?: string;
};

export type FleetNode = {
  id: string;
  type: FleetNodeType;
  name: string;
  status: "online" | "offline" | "degraded";
  lastHeartbeat: string;
  version?: string;
  config?: Record<string, unknown>;
  tenantId?: string;
  registeredAt: string;
  metrics?: {
    cpuPercent?: number;
    memPercent?: number;
    diskPercent?: number;
    networkBytesIn?: number;
    networkBytesOut?: number;
  };
};

export type CostEntry = {
  resourceType: "cloud-run" | "gpu" | "redis" | "postgresql" | "ai-model" | "storage" | "network";
  tenantId: string;
  costMicroUsd: number;
  unit: string;
  quantity: number;
  timestamp: string;
};

export type CostRecommendation = {
  id: string;
  type: "scale-down" | "optimize" | "cleanup" | "consolidate";
  description: string;
  estimatedSavingsMicroUsd: number;
  priority: "low" | "medium" | "high";
  createdAt: string;
};

export type ComplianceCheck = {
  id: string;
  policy: string;
  category: "security" | "infrastructure" | "tenant-isolation" | "audit" | "drift" | "secrets";
  status: ComplianceStatus;
  details: string;
  checkedAt: string;
  tenantId?: string;
};

export type ScheduledJob = {
  id: string;
  name: string;
  schedule: string;
  handler: () => Promise<void>;
  status: JobStatus;
  lastRunAt?: string;
  nextRunAt?: string;
  tenantId?: string;
};
