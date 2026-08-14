import type { CloudRunController } from "@/lib/cloud/cloud-run-controller";
import type { CloudRunServiceSpec } from "@/lib/cloud/cloud-types";
import type { CloudRunClient } from "./cloud-run-adapter";

/** Bridges the builder deployment contract to the existing autonomous CloudRunController. */
export class CloudRunControllerClient implements CloudRunClient {
  constructor(
    private readonly controller: Pick<CloudRunController, "deploy">,
    private readonly defaults: {
      tenantId: string;
      requestedBy: string;
      projectId: string;
      reason?: string;
    },
  ) {}

  async deploy(request: {
    serviceName: string;
    region?: string;
    image?: string;
    environment?: Record<string, string>;
  }): Promise<{ deploymentId: string; endpoint?: string }> {
    const spec: CloudRunServiceSpec = {
      service: request.serviceName,
      region: request.region ?? "us-central1",
      projectId: this.defaults.projectId,
      image: request.image ?? "",
      env: request.environment ?? {},
    };

    const result = await this.controller.deploy({
      deploymentId: `${request.serviceName}-${Date.now().toString(36)}`,
      tenantId: this.defaults.tenantId,
      requestedBy: this.defaults.requestedBy,
      reason: this.defaults.reason ?? "HOARE governed builder deployment",
      spec,
    });

    return { deploymentId: result.deployment.id };
  }
}
