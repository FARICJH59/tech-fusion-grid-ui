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

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`missing_gcp_wif_configuration:${name}`);
  return value;
}

export function createWifConfig(): WorkloadIdentityFederationConfig {
  assertNoLongLivedKeys();
  return {
    projectId: required("GOOGLE_CLOUD_PROJECT_ID", env.GOOGLE_CLOUD_PROJECT_ID),
    region: required("GOOGLE_CLOUD_REGION", env.GOOGLE_CLOUD_REGION),
    poolProvider: required("GOOGLE_CLOUD_WIF_PROVIDER", env.GOOGLE_CLOUD_WIF_PROVIDER),
    serviceAccount: required("GOOGLE_CLOUD_WIF_SERVICE_ACCOUNT", env.GOOGLE_CLOUD_WIF_SERVICE_ACCOUNT),
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

  // Google Cloud SDKs consume Application Default Credentials. Production must
  // supply federated/attached workload credentials; no service-account key is
  // constructed or accepted by this layer.
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

  return { config, sdkPackages: PHASE7_GCP_SDKS, clients };
}
