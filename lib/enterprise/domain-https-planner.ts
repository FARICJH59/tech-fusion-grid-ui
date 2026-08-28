import type { HoareBuildIntent } from "./native-control-plane";

export interface HoareInfrastructurePlan {
  compute: "provider-selected" | "edge";
  network: "private-by-default";
  storage: "tenant-scoped";
  secrets: "managed-secret-store";
  observability: "enabled";
}

export interface HoareDomainHttpsPlan {
  exposure: "public" | "internal";
  domain?: string;
  tls: "required" | "not-required";
  certificate: "managed" | "none";
  routing: "tenant-aware";
}

export interface HoareDeploymentPlan {
  schema: "hoare.deployment-plan/v1";
  infrastructure: HoareInfrastructurePlan;
  domainHttps: HoareDomainHttpsPlan;
  approval: "required" | "policy-authorized";
  verification: string[];
}

export function createDeploymentPlan(intent: HoareBuildIntent): HoareDeploymentPlan {
  const publicEndpoint = Boolean(intent.domain);

  return {
    schema: "hoare.deployment-plan/v1",
    infrastructure: {
      compute: intent.providers?.length ? "provider-selected" : "edge",
      network: "private-by-default",
      storage: "tenant-scoped",
      secrets: "managed-secret-store",
      observability: "enabled",
    },
    domainHttps: {
      exposure: publicEndpoint ? "public" : "internal",
      domain: intent.domain,
      tls: publicEndpoint ? "required" : "not-required",
      certificate: publicEndpoint ? "managed" : "none",
      routing: "tenant-aware",
    },
    approval:
      intent.environment === "production" ? "required" : "policy-authorized",
    verification: [
      "identity-policy-validation",
      "tenant-isolation-validation",
      "network-policy-validation",
      "tls-validation",
      "health-check",
      "audit-evidence-capture",
    ],
  };
}

export function isSafeDeploymentPlan(plan: HoareDeploymentPlan): boolean {
  return (
    plan.infrastructure.network === "private-by-default" &&
    plan.infrastructure.storage === "tenant-scoped" &&
    plan.infrastructure.secrets === "managed-secret-store" &&
    plan.infrastructure.observability === "enabled" &&
    plan.domainHttps.routing === "tenant-aware" &&
    (!plan.domainHttps.domain || plan.domainHttps.tls === "required") &&
    plan.verification.includes("audit-evidence-capture")
  );
}
