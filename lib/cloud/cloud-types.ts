export type CloudActionType =
  | "deploy"
  | "revision-update"
  | "traffic-migration"
  | "rollback"
  | "scale"
  | "health-verify"
  | "remediation";

export type ApprovalStatus = "not-required" | "pending" | "approved" | "rejected" | "escalated";

export type ExecutionStatus = "requested" | "validated" | "approved" | "deploying" | "verifying" | "completed" | "rolled-back" | "failed";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type CloudActionEvent = {
  id: string;
  tenantId: string;
  actionType: CloudActionType;
  resource: string;
  requestedBy: string;
  reason: string;
  riskLevel: RiskLevel;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  approvalStatus: ApprovalStatus;
  executionStatus: ExecutionStatus;
  timestamp: string;
};

export type DeploymentLifecycleState =
  | "requested"
  | "validated"
  | "approved"
  | "deploying"
  | "verifying"
  | "completed"
  | "rolled-back";

export type CloudRunServiceSpec = {
  service: string;
  image: string;
  region: string;
  projectId: string;
  revisionSuffix?: string;
  minInstances?: number;
  maxInstances?: number;
  concurrency?: number;
  env?: Record<string, string>;
};

export type CloudRunTrafficTarget = {
  revision: string;
  percent: number;
  tag?: string;
};

export type CloudRunRevisionStatus = {
  service: string;
  region: string;
  latestRevision: string;
  traffic: CloudRunTrafficTarget[];
  status: "healthy" | "degraded" | "unhealthy";
  observedAt: string;
};

export type DeploymentRecord = {
  id: string;
  tenantId: string;
  requestedBy: string;
  service: string;
  region: string;
  targetImage: string;
  previousRevision?: string;
  nextRevision?: string;
  status: DeploymentLifecycleState;
  createdAt: string;
  updatedAt: string;
};

export type DeploymentEvent = {
  deploymentId: string;
  state: DeploymentLifecycleState;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type ScalingSignal = {
  tenantId: string;
  service: string;
  cpuUtilization: number;
  memoryUtilization: number;
  requestLatencyMs: number;
  errorRate: number;
  requestVolumePerMinute: number;
  queueDepth: number;
  tenantSlaLatencyMs: number;
  budgetLimitUsd: number;
  projectedCostUsd: number;
  regionalAvailability: number;
};

export type ScalingDecision = {
  tenantId: string;
  service: string;
  decision: "scale-up" | "scale-down" | "cost-protect" | "no-op";
  reason: string;
  target: {
    minInstances: number;
    maxInstances: number;
    concurrency: number;
  };
  requiresApproval: boolean;
};

export type RollbackTrigger =
  | "error-rate"
  | "failed-health-check"
  | "latency-regression"
  | "policy-violation"
  | "failed-verification";

export type RollbackRequest = {
  tenantId: string;
  service: string;
  region: string;
  fromRevision: string;
  toRevision: string;
  trigger: RollbackTrigger;
  reason: string;
};

export type CloudProviderHealth = {
  service: string;
  healthy: boolean;
  latencyMs: number;
  errorRate: number;
  checkedAt: string;
};
