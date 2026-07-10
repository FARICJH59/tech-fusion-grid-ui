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
  services: Record<(typeof GOOGLE_CLOUD_SERVICES)[number], { enabled: boolean }>;
};

export function createGoogleCloudProfile(region = "us-central1"): GoogleCloudProfile {
  const services = Object.fromEntries(
    GOOGLE_CLOUD_SERVICES.map((service) => [service, { enabled: true }]),
  ) as GoogleCloudProfile["services"];

  return {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ?? "caramel-limiter-495010-b9",
    region,
    services,
  };
}
