import { GcpCloudClient } from "@/lib/cloud/gcp-client";
import type { CloudRunServiceSpec } from "@/lib/cloud/cloud-types";
import type { RuntimeDeploymentRequest, RuntimeDeploymentResult, RuntimeProvider } from "./provider";

export class GcpRuntimeProvider implements RuntimeProvider {
  readonly kind = "gcp" as const;

  constructor(private readonly client: GcpCloudClient) {}

  async deploy(request: RuntimeDeploymentRequest): Promise<RuntimeDeploymentResult> {
    if (!request.application.image) {
      throw new Error(
        `Application ${request.application.id} has no container image`,
      );
    }

    const spec: CloudRunServiceSpec = {
      service: request.application.id,
      region: this.client.region,
      projectId: this.client.projectId,
      image: request.application.image,
      revisionSuffix: Date.now().toString(36),
    };

    const result = await this.client.deployService(spec);

    return {
      provider: this.kind,
      accepted: true,
      mode: "live",
      deploymentId: result.latestRevision,
      message: `Cloud Run deployment submitted for ${request.application.id}.`,
    };
  }
}
