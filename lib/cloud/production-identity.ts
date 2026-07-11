import { createWifConfig } from "@/lib/enterprise/cloud-runtime";

export type IamCapability =
  | "cloud-run"
  | "monitoring"
  | "logging"
  | "secret-manager"
  | "artifact-registry";

export type ProductionIdentityStatus = {
  mode: "workload-identity-federation";
  projectId: string;
  region: string;
  serviceAccount: string;
  provider: string;
  capabilities: Record<IamCapability, boolean>;
  keyless: boolean;
  hardcodedCredentials: boolean;
};

export function getProductionIdentityStatus(): ProductionIdentityStatus {
  const wif = createWifConfig();
  const hardcodedCredentials = Boolean(process.env.GOOGLE_PRIVATE_KEY || process.env.GCP_SERVICE_ACCOUNT_KEY);

  return {
    mode: wif.mode,
    projectId: wif.projectId,
    region: wif.region,
    serviceAccount: wif.serviceAccount,
    provider: wif.poolProvider,
    capabilities: {
      "cloud-run": true,
      monitoring: true,
      logging: true,
      "secret-manager": true,
      "artifact-registry": true,
    },
    keyless: !hardcodedCredentials,
    hardcodedCredentials,
  };
}
