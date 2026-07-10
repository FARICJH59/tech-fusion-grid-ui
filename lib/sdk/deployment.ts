import { BaseSdkClient } from "@/lib/sdk/base";
import type { SdkConfig, SdkResponse } from "@/lib/sdk/types";

type DeploymentRecord = {
  id: string;
  status: string;
  version?: string;
  createdAt?: string;
  [key: string]: unknown;
};

export class HoareDeploymentClient extends BaseSdkClient {
  constructor(config: SdkConfig) {
    super(config);
  }

  deployRuntime(payload: Record<string, unknown>): Promise<SdkResponse<DeploymentRecord>> {
    return this.post<DeploymentRecord>("deployments", payload);
  }

  getDeploymentStatus(deploymentId: string): Promise<SdkResponse<DeploymentRecord>> {
    return this.get<DeploymentRecord>(`deployments/${encodeURIComponent(deploymentId)}`);
  }

  listDeployments(): Promise<SdkResponse<DeploymentRecord[]>> {
    return this.get<DeploymentRecord[]>("deployments");
  }

  rollback(deploymentId: string): Promise<SdkResponse<DeploymentRecord>> {
    return this.post<DeploymentRecord>(`deployments/${encodeURIComponent(deploymentId)}/rollback`);
  }
}
