import { assertAttested, DeploymentAdapter, DeploymentRequest, DeploymentResult } from "./deployment-adapter";

export interface CloudRunClient {
  deploy(request: {
    serviceName: string;
    region?: string;
    image?: string;
    environment?: Record<string, string>;
  }): Promise<{ deploymentId: string; endpoint?: string }>;
}

export class CloudRunDeploymentAdapter implements DeploymentAdapter {
  readonly target = "cloud-run" as const;

  constructor(private readonly client: CloudRunClient) {}

  async deploy(request: DeploymentRequest): Promise<DeploymentResult> {
    assertAttested(request);
    if (!request.serviceName) throw new Error("CLOUD_RUN_SERVICE_REQUIRED");

    const result = await this.client.deploy({
      serviceName: request.serviceName,
      region: request.region,
      image: request.image,
      environment: request.environment,
    });

    return {
      unitId: request.unitId,
      target: this.target,
      accepted: true,
      deploymentId: result.deploymentId,
      endpoint: result.endpoint,
      message: "Cloud Run deployment accepted after attestation validation",
    };
  }
}
