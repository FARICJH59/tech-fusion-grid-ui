import { env } from "@/lib/env";

export const PHASE7_GCP_SDKS = [
  "@google-cloud/run",
  "@google-cloud/pubsub",
  "@google-cloud/secret-manager",
  "@google-cloud/logging",
  "@google-cloud/monitoring",
  "@google-cloud/artifact-registry",
] as const;

export type WorkloadIdentityFederationConfig = {
  projectId: string;
  region: string;
  poolProvider: string;
  serviceAccount: string;
  mode: "workload-identity-federation";
};

export type CloudSdkClients = {
  run: unknown | null;
  pubsub: unknown | null;
  secretManager: unknown | null;
  logging: unknown | null;
  monitoring: unknown | null;
  artifactRegistry: unknown | null;
};

function assertNoLongLivedKeys() {
  if (process.env.GOOGLE_PRIVATE_KEY || process.env.GCP_SERVICE_ACCOUNT_KEY) {
    throw new Error("Long-lived service account keys are not allowed. Use Workload Identity Federation.");
  }
}

export function createWifConfig(): WorkloadIdentityFederationConfig {
  assertNoLongLivedKeys();
  return {
    projectId: env.GOOGLE_CLOUD_PROJECT_ID ?? "caramel-limiter-495010-b9",
    region: process.env.GOOGLE_CLOUD_REGION ?? "us-central1",
    poolProvider:
      process.env.GOOGLE_CLOUD_WIF_PROVIDER ??
      "projects/000000000/locations/global/workloadIdentityPools/default/providers/default",
    serviceAccount:
      process.env.GOOGLE_CLOUD_WIF_SERVICE_ACCOUNT ??
      "hoare-runtime@caramel-limiter-495010-b9.iam.gserviceaccount.com",
    mode: "workload-identity-federation",
  };
}

const CLOUD_PLATFORM_SCOPE = ["https://www.googleapis.com/auth/cloud-platform"];

export async function createGoogleCloudRuntime(): Promise<{
  config: WorkloadIdentityFederationConfig;
  sdkPackages: readonly string[];
  clients: CloudSdkClients;
}> {
  const config = createWifConfig();
  const options = {
    projectId: config.projectId,
    scopes: CLOUD_PLATFORM_SCOPE,
  };

  const runModule = await import("@google-cloud/run");
  const pubsubModule = await import("@google-cloud/pubsub");
  const secretManagerModule = await import("@google-cloud/secret-manager");
  const loggingModule = await import("@google-cloud/logging");
  const monitoringModule = await import("@google-cloud/monitoring");
  const artifactRegistryModule = await import("@google-cloud/artifact-registry");

  const clients: CloudSdkClients = {
    run: "ServicesClient" in runModule ? new (runModule as { ServicesClient: new (opts: unknown) => unknown }).ServicesClient(options) : null,
    pubsub: "PubSub" in pubsubModule ? new (pubsubModule as { PubSub: new (opts: unknown) => unknown }).PubSub(options) : null,
    secretManager:
      "SecretManagerServiceClient" in secretManagerModule
        ? new (secretManagerModule as { SecretManagerServiceClient: new (opts: unknown) => unknown }).SecretManagerServiceClient(options)
        : null,
    logging: "Logging" in loggingModule ? new (loggingModule as { Logging: new (opts: unknown) => unknown }).Logging(options) : null,
    monitoring:
      "MetricServiceClient" in monitoringModule
        ? new (monitoringModule as { MetricServiceClient: new (opts: unknown) => unknown }).MetricServiceClient(options)
        : null,
    artifactRegistry:
      "ArtifactRegistryClient" in artifactRegistryModule
        ? new (artifactRegistryModule as { ArtifactRegistryClient: new (opts: unknown) => unknown }).ArtifactRegistryClient(options)
        : null,
  };

  return {
    config,
    sdkPackages: PHASE7_GCP_SDKS,
    clients,
  };
}
