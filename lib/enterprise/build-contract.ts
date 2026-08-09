import type { LayerName, TenantContext } from "@/lib/enterprise/types";

export const BUILD_CONTRACT_VERSION = "1.0" as const;

export const BUILD_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type BuildRiskLevel = (typeof BUILD_RISK_LEVELS)[number];

export const BUILD_APPROVAL_MODES = ["automatic", "approval-required", "manual"] as const;
export type BuildApprovalMode = (typeof BUILD_APPROVAL_MODES)[number];

export const BUILD_LIFECYCLE_STATES = [
  "draft",
  "validated",
  "planned",
  "awaiting-approval",
  "executing",
  "completed",
  "failed",
  "rolled-back",
] as const;
export type BuildLifecycleState = (typeof BUILD_LIFECYCLE_STATES)[number];

export type BuildTarget = {
  provider: string;
  runtime: string;
  region: string;
  environment: "development" | "staging" | "production";
};

export type BuildSecurityRequirements = {
  zeroTrust: boolean;
  phishingResistantMfa: boolean;
  devicePosture: boolean;
  mtls: boolean;
  tenantIsolation: boolean;
};

export type BuildObservabilityRequirements = {
  auditLog: boolean;
  telemetry: boolean;
  tracing: boolean;
  incidentDetection: boolean;
};

export type BuildContract = {
  version: typeof BUILD_CONTRACT_VERSION;
  id: string;
  tenant: TenantContext;
  application: string;
  intent: string;
  target: BuildTarget;
  risk: BuildRiskLevel;
  approvalMode: BuildApprovalMode;
  requiredCapabilities: string[];
  security: BuildSecurityRequirements;
  observability: BuildObservabilityRequirements;
  policyIds: string[];
  infrastructureLayer: LayerName;
  adapter: string;
  rollbackRequired: boolean;
  lifecycle: BuildLifecycleState;
  metadata: Record<string, string>;
};

export type BuildContractValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

function nonEmpty(value: string, field: string, errors: string[]) {
  if (!value.trim()) errors.push(`${field} must not be empty`);
}

export function validateBuildContract(contract: BuildContract): BuildContractValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (contract.version !== BUILD_CONTRACT_VERSION) {
    errors.push(`Unsupported build contract version: ${contract.version}`);
  }

  nonEmpty(contract.id, "id", errors);
  nonEmpty(contract.tenant.tenantId, "tenant.tenantId", errors);
  nonEmpty(contract.tenant.organizationId, "tenant.organizationId", errors);
  nonEmpty(contract.application, "application", errors);
  nonEmpty(contract.intent, "intent", errors);
  nonEmpty(contract.target.provider, "target.provider", errors);
  nonEmpty(contract.target.runtime, "target.runtime", errors);
  nonEmpty(contract.target.region, "target.region", errors);
  nonEmpty(contract.adapter, "adapter", errors);

  if (contract.requiredCapabilities.length === 0) {
    warnings.push("No explicit runtime capabilities were requested");
  }

  if (contract.target.environment === "production" && contract.approvalMode === "automatic") {
    warnings.push("Production automatic execution requires policy authorization and Aegis validation");
  }

  if (contract.risk === "critical" && contract.approvalMode === "automatic") {
    errors.push("Critical builds cannot use automatic approval mode");
  }

  if (contract.risk === "high" || contract.risk === "critical") {
    if (!contract.rollbackRequired) errors.push("High-risk builds require rollback protection");
    if (!contract.observability.auditLog) errors.push("High-risk builds require audit logging");
    if (!contract.observability.incidentDetection) {
      errors.push("High-risk builds require incident detection");
    }
  }

  if (contract.security.tenantIsolation && !contract.tenant.tenantId) {
    errors.push("Tenant isolation requires a tenant identity");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function createBuildContract(
  input: Omit<BuildContract, "version" | "lifecycle">,
): BuildContract {
  const contract: BuildContract = {
    ...input,
    version: BUILD_CONTRACT_VERSION,
    lifecycle: "draft",
  };

  const validation = validateBuildContract(contract);
  if (!validation.valid) {
    throw new Error(`Invalid HOARE build contract: ${validation.errors.join("; ")}`);
  }

  return contract;
}
