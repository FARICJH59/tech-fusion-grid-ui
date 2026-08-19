import type { HoareBuildIntent } from "./native-control-plane";

export type WorkloadClass = "chat" | "reasoning" | "vision" | "document" | "agentic" | "edge";
export type SecuritySensitivity = "low" | "moderate" | "high" | "critical";

export interface HoareArchitecturePlan {
  workloadClass: WorkloadClass;
  securitySensitivity: SecuritySensitivity;
  modelStrategy: "provider-neutral";
  identityStrategy: "temporary-credentials";
  policyStrategy: "least-privilege";
  domainStrategy: "https-first" | "internal-only";
  requiredCapabilities: string[];
}

export interface HoareIamPlan {
  provider: "aws" | "gcp" | "azure";
  roleBoundary: "tenant-agent";
  credentialStrategy: "temporary";
  permissions: string[];
  forbidden: string[];
}

export interface HoareBuilderPlan {
  schema: "hoare.builder-plan/v1";
  intent: HoareBuildIntent;
  architecture: HoareArchitecturePlan;
  iam: HoareIamPlan[];
  validation: {
    providerNeutral: boolean;
    productionApprovalRequired: boolean;
    longLivedCredentialsAllowed: false;
  };
}

function inferWorkload(description: string): WorkloadClass {
  const text = description.toLowerCase();
  if (/vision|image|video|camera|ocr/.test(text)) return "vision";
  if (/document|pdf|translation|ocr|file/.test(text)) return "document";
  if (/reasoning|analysis|planning/.test(text)) return "reasoning";
  if (/agent|autonomous|workflow/.test(text)) return "agentic";
  if (/edge|iot|device|sensor/.test(text)) return "edge";
  return "chat";
}

function inferSensitivity(description: string): SecuritySensitivity {
  const text = description.toLowerCase();
  if (/defense|military|classified|critical|regulated/.test(text)) return "critical";
  if (/pii|health|financial|secret|sensitive/.test(text)) return "high";
  if (/enterprise|private|internal/.test(text)) return "moderate";
  return "low";
}

export function createHoareBuilderPlan(intent: HoareBuildIntent): HoareBuilderPlan {
  const workloadClass = inferWorkload(intent.description);
  const securitySensitivity = inferSensitivity(intent.description);
  const productionApprovalRequired = intent.environment === "production";
  const providers = (intent.providers?.length ? intent.providers : ["edge"]).filter(
    (provider): provider is "aws" | "gcp" | "azure" =>
      provider === "aws" || provider === "gcp" || provider === "azure",
  );

  return {
    schema: "hoare.builder-plan/v1",
    intent,
    architecture: {
      workloadClass,
      securitySensitivity,
      modelStrategy: "provider-neutral",
      identityStrategy: "temporary-credentials",
      policyStrategy: "least-privilege",
      domainStrategy: intent.domain ? "https-first" : "internal-only",
      requiredCapabilities: [
        "identity",
        "tenant-isolation",
        "policy",
        "model-selection",
        "observability",
        "evidence",
      ],
    },
    iam: providers.map((provider) => ({
      provider,
      roleBoundary: "tenant-agent",
      credentialStrategy: "temporary",
      permissions:
        workloadClass === "document"
          ? ["translation.invoke", "storage.read-scoped", "storage.write-scoped"]
          : ["model.invoke"],
      forbidden: ["iam.*", "admin.*", "long-lived-credentials"],
    })),
    validation: {
      providerNeutral: true,
      productionApprovalRequired,
      longLivedCredentialsAllowed: false,
    },
  };
}
