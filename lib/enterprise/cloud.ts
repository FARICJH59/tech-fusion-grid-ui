import { createWifConfig, PHASE7_GCP_SDKS } from "@/lib/enterprise/cloud-runtime";

export const GOOGLE_CLOUD_SERVICES = [
  "Cloud Run",
  "Artifact Registry",
  "Secret Manager",
  "Cloud SQL",
  "Pub/Sub",
  "Cloud Scheduler",
  "Cloud Logging",
  "Cloud Monitoring",
  "IAM Workload Identity Federation",
] as const;

export type GoogleCloudProfile = {
  projectId: string;
  region: string;
  auth: {
    mode: "workload-identity-federation";
    provider: string;
    serviceAccount: string;
  };
  sdkIntegrations: readonly string[];
  services: Record<(typeof GOOGLE_CLOUD_SERVICES)[number], { enabled: boolean }>;
};

export function createGoogleCloudProfile(region = "us-central1"): GoogleCloudProfile {
  const wif = createWifConfig();
  const services = Object.fromEntries(
    GOOGLE_CLOUD_SERVICES.map((service) => [service, { enabled: true }]),
  ) as GoogleCloudProfile["services"];

  return {
    projectId: wif.projectId,
    region: process.env.GOOGLE_CLOUD_REGION ?? region,
    auth: {
      mode: wif.mode,
      provider: wif.poolProvider,
      serviceAccount: wif.serviceAccount,
    },
    sdkIntegrations: PHASE7_GCP_SDKS,
    services,
  };
}
