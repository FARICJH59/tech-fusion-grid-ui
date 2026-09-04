import { GcpCloudClient } from "@/lib/cloud/gcp-client";
import type { CloudRunServiceSpec } from "@/lib/cloud/cloud-types";
import type { RuntimeDeploymentRequest, RuntimeDeploymentResult, RuntimeProvider } from "./provider";

export class GcpRuntimeProvider implements RuntimeProvider {
  readonly kind = "gcp" as const;

  constructor(private readonly client: GcpCloudClient) {}

  async deploy(request: RuntimeDeploymentRequest): Promise<RuntimeDeploymentResult> {
    const image = (request.application as typeof request.application & { image?: unknown }).image;
    if (typeof image !== "string" || image.trim().length === 0) {
      throw new Error("application_image_required_for_gcp");
    }

    const spec: CloudRunServiceSpec = {
      service: request.application.id,
      region: this.client.region,
      projectId: this.client.projectId,
      image,
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
